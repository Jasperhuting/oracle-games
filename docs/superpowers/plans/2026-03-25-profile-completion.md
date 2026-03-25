# Profile Completion Feature Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encourage users to complete their profile (avatar, date of birth, name, language) via a one-time onboarding page, a completeness card on the account page, and a nudge inside the CarriereCard.

**Architecture:** A pure utility `getProfileCompleteness` centralises score logic and is called client-side in `AccountPageContent` after its existing user fetch. The result flows as props to two new/modified components. A new API endpoint `POST /api/user/onboarding` handles the onboarding form submit. The onboarding page is a server component that redirects ineligible users before rendering.

**Tech Stack:** Next.js 14 App Router, TypeScript, Firestore (Firebase Admin), Tailwind CSS, Cloudinary (existing), Vitest (unit tests)

**Spec:** `docs/superpowers/specs/2026-03-25-profile-completion-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `lib/profile/completeness.ts` | Create | Pure utility: score + missing fields |
| `tests/unit/lib/profile/completeness.test.ts` | Create | Vitest unit tests for the utility |
| `app/api/user/onboarding/route.ts` | Create | POST endpoint: save profile fields + set onboardingShown |
| `app/api/createUser/route.ts` | Modify (line 54) | Add `onboardingShown: false` to initial user doc |
| `components/account/ProfileCompletenessCard.tsx` | Create | Green card with progress bar, chips, dismiss |
| `components/AccountPageContent.tsx` | Modify | Hoist fetchUserData, compute completeness, render card + pass to CarriereCard |
| `components/account/CarriereCard.tsx` | Modify | Add optional `completeness` prop, render badge + nudge block |
| `app/welkom/OnboardingForm.tsx` | Create | 'use client' form component for the onboarding page |
| `app/welkom/page.tsx` | Create | Server component: auth guard → render OnboardingForm |

---

## Chunk 1: Completeness Utility + Tests

### Task 1: `getProfileCompleteness` utility

**Files:**
- Create: `lib/profile/completeness.ts`
- Create: `tests/unit/lib/profile/completeness.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/lib/profile/completeness.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getProfileCompleteness, FIELD_LABELS } from '@/lib/profile/completeness';

describe('getProfileCompleteness', () => {
  it('returns score 28 when only playername and email are set', () => {
    const result = getProfileCompleteness({ playername: 'Jasper', email: 'j@j.nl' } as any);
    expect(result.score).toBe(28); // floor(2/7*100)
    expect(result.missingFields).toEqual(['firstName', 'lastName', 'avatarUrl', 'dateOfBirth', 'preferredLanguage']);
  });

  it('returns score 100 when all fields are set', () => {
    const result = getProfileCompleteness({
      playername: 'Jasper', email: 'j@j.nl',
      firstName: 'Jasper', lastName: 'Huting',
      avatarUrl: 'https://cdn.example.com/a.jpg',
      dateOfBirth: '1990-01-01',
      preferredLanguage: 'nl',
    } as any);
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('treats empty string as missing', () => {
    const result = getProfileCompleteness({ playername: 'Jasper', email: 'j@j.nl', firstName: '' } as any);
    expect(result.missingFields).toContain('firstName');
  });

  it('never includes playername or email in missingFields', () => {
    const result = getProfileCompleteness({ playername: '', email: '' } as any);
    expect(result.missingFields).not.toContain('playername');
    expect(result.missingFields).not.toContain('email');
  });
});

describe('FIELD_LABELS', () => {
  it('has a label for every optional field', () => {
    const optionalFields = ['firstName', 'lastName', 'avatarUrl', 'dateOfBirth', 'preferredLanguage'];
    for (const field of optionalFields) {
      expect(FIELD_LABELS[field as keyof typeof FIELD_LABELS]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
yarn vitest run tests/unit/lib/profile/completeness.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement the utility**

Create `lib/profile/completeness.ts`:

```ts
export type FieldKey =
  | 'playername'
  | 'email'
  | 'firstName'
  | 'lastName'
  | 'avatarUrl'
  | 'dateOfBirth'
  | 'preferredLanguage';

export interface ProfileCompleteness {
  score: number;          // integer 0–100
  missingFields: FieldKey[];
}

export const FIELD_LABELS: Record<Exclude<FieldKey, 'playername' | 'email'>, string> = {
  firstName: 'Voornaam',
  lastName: 'Achternaam',
  avatarUrl: 'Avatar',
  dateOfBirth: 'Geboortedatum',
  preferredLanguage: 'Taalvoorkeur',
};

const OPTIONAL_FIELDS: Exclude<FieldKey, 'playername' | 'email'>[] = [
  'firstName',
  'lastName',
  'avatarUrl',
  'dateOfBirth',
  'preferredLanguage',
];

export function getProfileCompleteness(user: Record<string, unknown>): ProfileCompleteness {
  const missingFields = OPTIONAL_FIELDS.filter((key) => !user[key]);
  const filledCount = 7 - missingFields.length; // playername + email always filled
  return {
    score: Math.floor((filledCount / 7) * 100),
    missingFields,
  };
}

/** Build the Dutch sentence listing missing fields for the CarriereCard nudge */
export function buildMissingFieldsSentence(missingFields: FieldKey[]): string {
  if (missingFields.length === 0) return '';
  // Only include fields that have a display label (filters out 'playername'/'email' if ever passed)
  const labels = missingFields
    .filter((f): f is keyof typeof FIELD_LABELS => f in FIELD_LABELS)
    .map((f) => FIELD_LABELS[f]);
  let list: string;
  if (labels.length === 1) {
    list = `een **${labels[0]}**`;
  } else if (labels.length === 2) {
    list = `een **${labels[0]}** en **${labels[1]}**`;
  } else {
    const last = labels[labels.length - 1];
    const rest = labels.slice(0, -1).map((l) => `**${l}**`).join(', ');
    list = `${rest} en **${last}**`;
  }
  return `Voeg ${list} toe om je profiel compleet te maken.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
yarn vitest run tests/unit/lib/profile/completeness.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/profile/completeness.ts tests/unit/lib/profile/completeness.test.ts
git commit -m "feat: add getProfileCompleteness utility and tests"
```

---

## Chunk 2: Onboarding API Endpoint + Registration Flag

### Task 2: `POST /api/user/onboarding` endpoint

**Files:**
- Create: `app/api/user/onboarding/route.ts`

This endpoint is auth-protected via `userHandler`. It saves optional profile fields + `onboardingShown: true` to `users/{uid}`. It is idempotent — calling it multiple times is safe.

- [ ] **Step 1: Create the route**

Create `app/api/user/onboarding/route.ts`:

```ts
import { userHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = userHandler('user-onboarding', async ({ uid, request }) => {
  const body = await request.json();
  const { firstName, lastName, dateOfBirth, preferredLanguage, avatarUrl } = body;

  // Validate optional fields
  if (firstName !== undefined && firstName.length > 50) {
    throw new ApiError('Voornaam mag maximaal 50 tekens zijn', 400);
  }
  if (lastName !== undefined && lastName.length > 50) {
    throw new ApiError('Achternaam mag maximaal 50 tekens zijn', 400);
  }
  if (preferredLanguage !== undefined && !['nl', 'en'].includes(preferredLanguage)) {
    throw new ApiError('Ongeldige taalvoorkeur', 400);
  }
  if (dateOfBirth !== undefined) {
    const date = new Date(dateOfBirth);
    if (isNaN(date.getTime())) {
      throw new ApiError('Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)', 400);
    }
    // Naive year-only age check — matches existing behaviour in /api/updateUser
    const age = new Date().getFullYear() - date.getFullYear();
    if (age < 13 || age > 120) {
      throw new ApiError('Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)', 400);
    }
  }

  const db = getServerFirebase();
  const updateData: Record<string, unknown> = {
    onboardingShown: true,
    updatedAt: Timestamp.now(),
  };

  if (firstName !== undefined && firstName !== '') updateData.firstName = firstName;
  if (lastName !== undefined && lastName !== '') updateData.lastName = lastName;
  if (dateOfBirth !== undefined && dateOfBirth !== '') updateData.dateOfBirth = dateOfBirth;
  if (preferredLanguage !== undefined && preferredLanguage !== '') updateData.preferredLanguage = preferredLanguage;
  if (avatarUrl !== undefined && avatarUrl !== '') updateData.avatarUrl = avatarUrl;

  await db.collection('users').doc(uid).update(updateData);

  return { success: true };
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
yarn tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to the new file

- [ ] **Step 3: Commit**

```bash
git add app/api/user/onboarding/route.ts
git commit -m "feat: add POST /api/user/onboarding endpoint"
```

---

### Task 3: Add `onboardingShown: false` to new user creation

**Files:**
- Modify: `app/api/createUser/route.ts` (line 54)

- [ ] **Step 1: Add the field**

In `app/api/createUser/route.ts`, find the `db.collection('users').doc(uid).set({` call (starts at line 54). The exact current content is:

```ts
await db.collection('users').doc(uid).set({
  email,
  playername,
  createdAt: Timestamp.now(),
  uid,
  updatedAt: Timestamp.now(),
  userType: userType,
  authMethod: authMethod || 'email',
  lastLoginMethod: authMethod || 'email',
  lastLoginAt: Timestamp.now(),
  lastActiveAt: Timestamp.now(),
});
```

Add `onboardingShown: false,` after `playername,`:

```ts
await db.collection('users').doc(uid).set({
  email,
  playername,
  onboardingShown: false,   // ← add this line
  createdAt: Timestamp.now(),
  uid,
  updatedAt: Timestamp.now(),
  userType: userType,
  authMethod: authMethod || 'email',
  lastLoginMethod: authMethod || 'email',
  lastLoginAt: Timestamp.now(),
  lastActiveAt: Timestamp.now(),
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add app/api/createUser/route.ts
git commit -m "feat: write onboardingShown: false for new users at registration"
```

---

## Chunk 3: ProfileCompletenessCard + AccountPageContent

### Task 4: `ProfileCompletenessCard` component

**Files:**
- Create: `components/account/ProfileCompletenessCard.tsx`

This is a `'use client'` component. It shows/hides based on `score` and `sessionStorage`.

- [ ] **Step 1: Create the component**

Create `components/account/ProfileCompletenessCard.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProfileCompleteness, FieldKey } from '@/lib/profile/completeness';
import { FIELD_LABELS } from '@/lib/profile/completeness';

interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness;
}

const ALL_OPTIONAL_FIELDS: FieldKey[] = ['firstName', 'lastName', 'avatarUrl', 'dateOfBirth', 'preferredLanguage'];

export function ProfileCompletenessCard({ completeness }: ProfileCompletenessCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem('profileCardDismissed') === '1';
  });

  if (completeness.score >= 100 || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('profileCardDismissed', '1');
    setDismissed(true);
  };

  return (
    <div
      className="rounded-xl p-4 border mb-6"
      style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <span className="font-bold text-sm" style={{ color: '#166534' }}>
          Maak je profiel compleet
        </span>
        <span className="font-bold text-sm" style={{ color: '#16a34a' }}>
          {completeness.score}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="rounded-full h-2 overflow-hidden mb-3" style={{ background: '#dcfce7' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${completeness.score}%`, background: '#16a34a' }}
        />
      </div>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* Always-filled fields */}
        {(['playername', 'email'] as const).map((field) => (
          <span
            key={field}
            className="text-xs font-medium rounded-full px-3 py-1"
            style={{ background: '#16a34a', color: 'white' }}
          >
            ✓ {field === 'playername' ? 'Spelersnaam' : 'E-mail'}
          </span>
        ))}
        {/* Optional fields */}
        {ALL_OPTIONAL_FIELDS.map((field) => {
          const isMissing = completeness.missingFields.includes(field);
          return (
            <span
              key={field}
              className="text-xs font-medium rounded-full px-3 py-1"
              style={
                isMissing
                  ? { background: '#fef9c3', color: '#854d0e' }
                  : { background: '#16a34a', color: 'white' }
              }
            >
              {isMissing ? `+ ${FIELD_LABELS[field]}` : `✓ ${FIELD_LABELS[field]}`}
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/account/settings')}
          className="text-sm font-semibold rounded-lg px-4 py-2 text-white"
          style={{ background: '#02554d' }}
        >
          Profiel aanvullen →
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="text-sm text-gray-500"
        >
          Later
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/account/ProfileCompletenessCard.tsx
git commit -m "feat: add ProfileCompletenessCard component"
```

---

### Task 5: Refactor `AccountPageContent` — hoist fetchUserData + add completeness

**Files:**
- Modify: `components/AccountPageContent.tsx`

Changes:
1. Add `useCallback` import
2. Hoist `fetchUserData` into component scope as `useCallback`
3. Import `getProfileCompleteness` and `ProfileCompletenessCard`
4. Call `getProfileCompleteness(userData)` after fetch
5. Render `<ProfileCompletenessCard>` at top of content
6. Pass `completeness` prop to `<CarriereCard>`
7. Update `onAvatarUpdate` to also call `fetchUserData()`

- [ ] **Step 1: Update the imports at the top of `components/AccountPageContent.tsx`**

Add to imports:
```ts
import { useState, useEffect, useCallback } from "react";
import { getProfileCompleteness } from "@/lib/profile/completeness";
import { ProfileCompletenessCard } from "./account/ProfileCompletenessCard";
```

Remove `useEffect` from the existing `import { useState, useEffect }` (add `useCallback`).

- [ ] **Step 2: Hoist `fetchUserData` and add completeness state**

Replace the existing `useEffect` block with:

```ts
const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
        const userResponse = await fetch(`/api/getUser?userId=${user.uid}`);
        if (userResponse.ok) {
            const data = await userResponse.json();
            setUserData(data);
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
    } finally {
        setLoading(false);
    }
}, [user]);

useEffect(() => {
    fetchUserData();
}, [fetchUserData]);
```

- [ ] **Step 3: Compute completeness and render the card**

After the `loading` check (after line `if (loading) { return ... }`), before the final `return (`, add:

```ts
const completeness = userData ? getProfileCompleteness(userData) : { score: 100, missingFields: [] };
```

Then in the JSX, insert `<ProfileCompletenessCard completeness={completeness} />` just above the `<h1>` tag (inside the container div):

```tsx
<ProfileCompletenessCard completeness={completeness} />
<h1 className="text-3xl font-bold mb-6">{t('account.myAccount')}</h1>
```

- [ ] **Step 4: Update `onAvatarUpdate` on CarriereCard**

Update the `<CarriereCard>` call (do NOT add `completeness` prop yet — that prop doesn't exist until Task 6):

```tsx
<CarriereCard
    userId={user.uid}
    playername={playername}
    dateOfBirth={dateOfBirth}
    avatarUrl={avatarUrl}
    onAvatarUpdate={(newUrl) => {
        setUserData((prev: any) => ({ ...prev, avatarUrl: newUrl }));
        fetchUserData();
    }}
/>
```

Note: `setUserData` has changed from the closure form to the functional updater form `(prev) => ...` — this is intentional to avoid stale closure bugs.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add components/AccountPageContent.tsx
git commit -m "feat: hoist fetchUserData, compute completeness, render ProfileCompletenessCard"
```

---

## Chunk 4: CarriereCard Nudge

### Task 6: Add completeness nudge to `CarriereCard`

**Files:**
- Modify: `components/account/CarriereCard.tsx`

Changes:
1. Import `ProfileCompleteness`, `FIELD_LABELS`, `buildMissingFieldsSentence` from `lib/profile/completeness`
2. Add `completeness` as optional prop (default `{ score: 100, missingFields: [] }`)
3. Add `useRouter` import
4. Render yellow badge on avatar when `missingFields.length > 0`
5. Render progress nudge block below the Basic Info section when `score < 100`

- [ ] **Step 1: Add imports to CarriereCard**

Add at top of `components/account/CarriereCard.tsx`:

```ts
import { useRouter } from 'next/navigation';
import type { ProfileCompleteness } from '@/lib/profile/completeness';
import { FIELD_LABELS, buildMissingFieldsSentence } from '@/lib/profile/completeness';
```

- [ ] **Step 2: Update the props interface**

Add to `CarriereCardProps`:

```ts
completeness?: ProfileCompleteness;
```

Add to the destructuring:

```ts
export function CarriereCard({ userId, playername, dateOfBirth, avatarUrl, onAvatarUpdate, readOnly = false, completeness = { score: 100, missingFields: [] } }: CarriereCardProps) {
```

Add inside the component body (after existing state declarations):

```ts
const router = useRouter();
```

- [ ] **Step 3: Add `completeness` prop to CarriereCard call in AccountPageContent**

Now that CarriereCard accepts the prop (added in Step 2), update the `<CarriereCard>` in `components/AccountPageContent.tsx` to pass it:

```tsx
<CarriereCard
    userId={user.uid}
    playername={playername}
    dateOfBirth={dateOfBirth}
    avatarUrl={avatarUrl}
    completeness={completeness}
    onAvatarUpdate={(newUrl) => {
        setUserData((prev: any) => ({ ...prev, avatarUrl: newUrl }));
        fetchUserData();
    }}
/>
```

- [ ] **Step 4: Add yellow badge on the avatar (non-readOnly branch)**

The existing outer div at line ~217 in `components/account/CarriereCard.tsx` is `<div className="flex-shrink-0">`. **Replace** `className="flex-shrink-0"` with `className="flex-shrink-0 relative"` (do not add a new wrapper div). Then add the badge inside the non-readOnly branch, after `<AvatarUpload ... />`:

```tsx
<div className="flex-shrink-0 relative">
  {readOnly ? (
    /* existing readOnly block — unchanged */
  ) : (
    <>
      <AvatarUpload
        currentAvatarUrl={currentAvatarUrl}
        onUploadSuccess={handleAvatarUpload}
        size={100}
      />
      {completeness.missingFields.length > 0 && (
        <div
          className="absolute bottom-0 right-0 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
          style={{ background: '#f59e0b', minWidth: 20, height: 20, padding: '0 4px' }}
        >
          {completeness.missingFields.length}
        </div>
      )}
    </>
  )}
</div>
```

- [ ] **Step 5: Add progress nudge block below Basic Info**

The gradient header in CarriereCard is `<div className="bg-gradient-to-r from-primary-light to-white p-6">`. Inside it there is a flex row `<div className="flex items-center gap-6">` containing the avatar div and the Basic Info div. After the **closing `</div>` of that flex row** (but still inside the gradient header `<div>`, before its closing `</div>`), insert:

```tsx
{completeness.score < 100 && (
  <div className="mt-4 bg-white/70 rounded-lg p-3 border border-green-100">
    <div className="flex justify-between items-center mb-1">
      <span className="text-xs font-semibold text-gray-700">Profiel volledigheid</span>
      <span className="text-xs font-bold" style={{ color: '#02554d' }}>{completeness.score}%</span>
    </div>
    <div className="rounded-full overflow-hidden mb-2" style={{ background: '#e5e7eb', height: 6 }}>
      <div
        className="h-full rounded-full"
        style={{ width: `${completeness.score}%`, background: '#02554d' }}
      />
    </div>
    <p className="text-xs text-gray-600 mb-1">
      {buildMissingFieldsSentence(completeness.missingFields)}
    </p>
    <button
      type="button"
      onClick={() => router.push('/account/settings')}
      className="text-xs font-semibold"
      style={{ color: '#02554d' }}
    >
      Profiel aanvullen →
    </button>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -30
```

Expected: no errors

- [ ] **Step 7: Commit both files**

```bash
git add components/account/CarriereCard.tsx components/AccountPageContent.tsx
git commit -m "feat: add completeness nudge (badge + progress block) to CarriereCard"
```

---

## Chunk 5: Onboarding Page

### Task 7: Onboarding form client component

**Files:**
- Create: `app/welkom/OnboardingForm.tsx`

This is the interactive part of the onboarding page. It is a `'use client'` component.

- [ ] **Step 1: Create `app/welkom/OnboardingForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarUpload } from '@/components/account/AvatarUpload';

export function OnboardingForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'nl' | 'en'>('nl');
  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | null>(null);
  const [dateError, setDateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const buildPayload = () => {
    const payload: Record<string, string> = {};
    if (firstName.trim()) payload.firstName = firstName.trim();
    if (lastName.trim()) payload.lastName = lastName.trim();
    if (dateOfBirth.trim()) {
      // Convert DD-MM-YYYY to YYYY-MM-DD
      const parts = dateOfBirth.trim().split('-');
      if (parts.length === 3) {
        payload.dateOfBirth = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    }
    if (preferredLanguage) payload.preferredLanguage = preferredLanguage;
    if (pendingAvatarUrl) payload.avatarUrl = pendingAvatarUrl;
    return payload;
  };

  const submit = async (payload: Record<string, string>) => {
    setSubmitting(true);
    setDateError('');
    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        // Show date error inline; for all other errors redirect anyway
        // (non-critical onboarding — user can fix via Settings later)
        if (data.error?.includes('geboortedatum')) {
          setDateError(data.error);
          setSubmitting(false);
          return;
        }
      }
    } catch {
      // continue to redirect even on network error
    }
    // Note: submitting stays true here — router.push unmounts the component
    router.push('/');
  };

  const handleSave = () => submit(buildPayload());
  const handleLater = () => submit(pendingAvatarUrl ? { avatarUrl: pendingAvatarUrl } : {});

  return (
    <div className="min-h-screen flex items-start justify-center pt-16 px-4 pb-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">👋</div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">Welkom bij Oracle Games!</h1>
          <p className="text-sm text-gray-500">
            Je account is aangemaakt. Maak je profiel even compleet — dit duurt minder dan een minuut.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {/* Avatar */}
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 flex items-center gap-4">
            <AvatarUpload
              currentAvatarUrl={pendingAvatarUrl || undefined}
              onUploadSuccess={(url) => setPendingAvatarUrl(url)}
              size={56}
            />
            <div>
              <div className="font-semibold text-sm">Profielfoto</div>
              <div className="text-xs text-gray-500">Laat anderen zien wie je bent</div>
            </div>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Voornaam
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jasper"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Achternaam
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Huting"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Date of birth */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Geboortedatum
            </label>
            <input
              type="text"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              placeholder="DD-MM-YYYY"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {dateError && (
              <p className="text-xs text-red-600 mt-1">{dateError}</p>
            )}
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
              Taal
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['nl', 'en'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setPreferredLanguage(lang)}
                  className="rounded-lg p-3 text-center border-2 transition-colors"
                  style={{
                    borderColor: preferredLanguage === lang ? '#02554d' : '#e5e7eb',
                    background: preferredLanguage === lang ? '#f0fdf4' : 'white',
                  }}
                >
                  <div className="text-xl">{lang === 'nl' ? '🇳🇱' : '🇬🇧'}</div>
                  <div
                    className="text-sm font-bold mt-1"
                    style={{ color: preferredLanguage === lang ? '#02554d' : '#374151' }}
                  >
                    {lang.toUpperCase()}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: preferredLanguage === lang ? '#166534' : '#6b7280' }}
                  >
                    {lang === 'nl' ? 'Nederlands' : 'English'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting}
              className="flex-1 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: '#02554d' }}
            >
              Opslaan en verder
            </button>
            <button
              type="button"
              onClick={handleLater}
              disabled={submitting}
              className="px-4 py-3 rounded-lg text-sm text-gray-500 border border-gray-200 disabled:opacity-60"
            >
              Later
            </button>
          </div>
          <p className="text-center text-xs text-gray-400">
            Je kunt dit altijd later aanpassen via Instellingen
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add app/welkom/OnboardingForm.tsx
git commit -m "feat: add OnboardingForm client component"
```

---

### Task 8: Onboarding server page

**Files:**
- Create: `app/welkom/page.tsx`

This server component performs auth + Firestore guards and renders `<OnboardingForm>`.

- [ ] **Step 1: Create `app/welkom/page.tsx`**

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getServerAuth, getServerFirebase } from '@/lib/firebase/server';
import { OnboardingForm } from './OnboardingForm';

export default async function WelkomPage() {
  // 1. Read session cookie
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;

  if (!sessionCookie) {
    redirect('/login');
  }

  // 2. Verify session + email_verified
  // Note: verifySessionCookie without a second arg matches all other routes in this codebase.
  // We additionally check email_verified because /welkom should only be reachable after
  // the user has confirmed their email address (this is intentional policy).
  let uid: string;
  try {
    const auth = getServerAuth();
    const decoded = await auth.verifySessionCookie(sessionCookie);
    if (!decoded.email_verified) {
      redirect('/login');
    }
    uid = decoded.uid;
  } catch {
    redirect('/login');
  }

  // 3. Check onboardingShown
  const db = getServerFirebase();
  const userDoc = await db.collection('users').doc(uid).get();
  const onboardingShown = userDoc.data()?.onboardingShown;

  // Missing or true → skip (existing users or already completed)
  if (onboardingShown !== false) {
    redirect('/');
  }

  return <OnboardingForm />;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
yarn tsc --noEmit 2>&1 | head -20
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add app/welkom/page.tsx
git commit -m "feat: add /welkom onboarding server page with auth guard"
```

---

## Manual Verification Checklist

After all tasks are committed, verify the following flows manually:

**New user onboarding:**
1. Register a new account
2. After e-mail verification, navigate to `/welkom`
3. Verify the onboarding page renders correctly (avatar upload, name fields, date, language tiles)
4. Fill in some fields and click "Opslaan en verder"
5. Verify redirect to `/`, `onboardingShown: true` written in Firestore, fields saved
6. Navigate to `/welkom` again — verify redirect to `/`

**Later flow:**
1. Register a new account
2. Go to `/welkom`, click "Later"
3. Verify redirect to `/`, `onboardingShown: true` written (no other fields)

**Completeness card on `/account`:**
1. Log in with an account that has missing optional fields
2. Go to `/account`
3. Verify the green completeness card appears at top
4. Verify chips: green for filled fields, yellow for missing
5. Click "Profiel aanvullen →" — verify redirect to `/account/settings`
6. Click "Later" — verify card disappears
7. Refresh page — verify card is back (sessionStorage clears)

**CarriereCard nudge:**
1. Log in with an account that has missing optional fields
2. Go to `/account`
3. Verify yellow badge on avatar shows count of missing fields
4. Verify progress block shows correct percentage and missing field names
5. Upload a new avatar inside the card
6. Verify completeness score updates (re-fetch triggered)

**Existing users:**
1. Log in with an existing user (no `onboardingShown` field)
2. Navigate to `/welkom`
3. Verify redirect to `/` (treated as already shown)
