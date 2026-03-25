# Profile Completion Feature — Design Spec

**Date:** 2026-03-25
**Status:** Approved by user

---

## Goal

Increase the number of users who fill in their avatar and date of birth by introducing a lightweight profile completion flow: a one-time onboarding step after registration, a persistent completeness card on the account page, and a nudge inside the profile card.

---

## Completeness Score

7 fields total. 2 are always filled (spelersnaam, e-mail). 5 are optional targets:

| Field | Key in Firestore `users` doc | Always filled? |
|---|---|---|
| Spelersnaam | `playername` | yes |
| E-mail | `email` | yes |
| Voornaam | `firstName` | no |
| Achternaam | `lastName` | no |
| Avatar | `avatarUrl` | no |
| Geboortedatum | `dateOfBirth` | no |
| Taalvoorkeur | `preferredLanguage` | no |

Score = number of non-empty fields / 7 × 100, rounded down to an integer (0–100).

### `getProfileCompleteness` utility

```ts
// lib/profile/completeness.ts
type FieldKey = 'playername' | 'email' | 'firstName' | 'lastName' | 'avatarUrl' | 'dateOfBirth' | 'preferredLanguage';

interface ProfileCompleteness {
  score: number;          // integer 0–100
  missingFields: FieldKey[];   // only optional fields; never contains 'playername' or 'email'
}

function getProfileCompleteness(user: UserDoc): ProfileCompleteness
```

`missingFields` only ever contains optional field keys (`firstName`, `lastName`, `avatarUrl`, `dateOfBirth`, `preferredLanguage`). `playername` and `email` are always treated as filled.

Display label mapping (used for chips and dynamic text):
- `firstName` → "Voornaam"
- `lastName` → "Achternaam"
- `avatarUrl` → "Avatar"
- `dateOfBirth` → "Geboortedatum"
- `preferredLanguage` → "Taalvoorkeur"

---

## Feature 1 — Onboarding page (`/welkom`)

### Trigger
Shown once after a new user verifies their e-mail. A dedicated endpoint writes `onboardingShown: true` along with any submitted profile fields. The page is never shown again after that.

**Existing users** (created before this feature is deployed): their documents will not have `onboardingShown`. Treat a missing or `undefined` flag as `true` — existing users skip the onboarding page. Only brand-new accounts (created after deploy) have `onboardingShown: false` written at registration.

### Route
`app/welkom/page.tsx` — server component with auth guard. Use `cookies()` from `next/headers` + `getServerAuth().verifySessionCookie(sessionCookie, true)` (the second arg `true` checks revocation). The decoded token is a Firebase `DecodedIdToken` with `email_verified: boolean`.

Guard order:
1. No session cookie / `verifySessionCookie` throws → redirect to `/login`
2. `decodedToken.email_verified !== true` → redirect to `/login`
3. Fetch `users/{decodedToken.uid}` from Firestore; if `onboardingShown !== false` (including `undefined`) → redirect to `/`
4. All checks pass → render the page

### UI
- Header: 👋 "Welkom bij Oracle Games!" + subtitle
- Avatar upload: render `<AvatarUpload>` (`components/account/AvatarUpload.tsx`). The component uses the Cloudinary upload widget. On `onUploadSuccess(url)` store the returned Cloudinary URL in local component state (`pendingAvatarUrl`).
- First name / last name (side-by-side grid)
- Date of birth (text input, placeholder `DD-MM-YYYY`)
- Inline error below date field: "Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)" — shown when server returns 400 for dateOfBirth
- Language preference: two tile buttons — 🇳🇱 NL / Nederlands (default selected) and 🇬🇧 EN / English
- CTA: "Opslaan en verder" (primary) + "Later" (secondary, ghost)
- Footer note: "Je kunt dit altijd later aanpassen via Instellingen"

**Required env vars on this page:** `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` and `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` (already set for the existing avatar upload flow).

### Date format
The UI shows `DD-MM-YYYY` for readability. The client converts to `YYYY-MM-DD` before submitting.

### Behaviour
- "Opslaan en verder": POSTs non-empty fields (including `pendingAvatarUrl` if set) to `POST /api/user/onboarding`, then redirects to `/`
- "Later": POSTs `{ avatarUrl: pendingAvatarUrl }` if an image was uploaded (so the Cloudinary URL is not lost), otherwise POSTs `{}`, then redirects to `/`
- Partially filled form is valid — any non-empty subset of fields is accepted
- **Empty / blank text fields are stripped before POST** (not sent)
- A previously set field is never cleared via this form

> Note on Cloudinary uploads: the image is uploaded to Cloudinary immediately when the user closes the widget, before the form is submitted. The URL is persisted in both "Opslaan" and "Later" POSTs as long as `pendingAvatarUrl` is set. This may leave orphaned Cloudinary assets if the user uploads and then closes the browser without submitting, but this matches the behaviour of the existing avatar upload elsewhere in the app and is acceptable.

### API — new endpoint `POST /api/user/onboarding`

New route at `app/api/user/onboarding/route.ts`. Auth via session cookie (use existing `userHandler`).

Accepts: `{ firstName?, lastName?, dateOfBirth?, preferredLanguage?, avatarUrl? }`

**Idempotent / upsert behaviour:** always succeeds (even if `onboardingShown` is already `true`). Writes `onboardingShown: true` and any provided fields on every call.

Writes to `users/{uid}` in a single Firestore `update()`:
- Any provided non-empty optional fields
- `onboardingShown: true`
- `updatedAt: Timestamp.now()`

**Does not change `playername`.**

Validation (server-side):
- `dateOfBirth`: parse as `new Date(dateOfBirth)`. Age = `today.getFullYear() - date.getFullYear()` (same naive calculation as `updateUser`). Reject with `400` if invalid, age < 13 or age > 120. Error: `{ error: 'Vul een geldige geboortedatum in (minimumleeftijd 13 jaar)' }`
- `preferredLanguage`: must be `'nl'` or `'en'`. Reject with `400` otherwise.
- `firstName` / `lastName`: max 50 chars. Reject with `400` if exceeded.

Returns `{ success: true }` on success.

---

## Feature 2 — Completeness card on `/account`

### Architecture
`app/account/page.tsx` wraps `<AccountPageContent />` (`components/AccountPageContent.tsx`), a `'use client'` component that fetches user data via `GET /api/getUser`. After the fetch resolves, call `getProfileCompleteness(userData)` and pass the result as a prop to `<ProfileCompletenessCard>`.

### Trigger
Shown when `score < 100` AND `sessionStorage.profileCardDismissed !== '1'`. Disappears permanently once `score === 100` (no sessionStorage check needed then).

### UI
- Green card (`#f0fdf4` background, `#bbf7d0` border)
- Header row: "Maak je profiel compleet" (bold, `#166534`) + score `%` (right-aligned, `#16a34a`)
- Progress bar (green `#16a34a`, `#dcfce7` track, `h-2`, rounded)
- Chips row:
  - `playername` and `email` always render as green ✓ chips (hard-coded; never yellow)
  - The 5 optional fields: green ✓ chip if **not** in `missingFields`, yellow + chip if in `missingFields`
- CTA: "Profiel aanvullen →" button → `router.push('/account/settings')`
- "Later" text button → sets `sessionStorage.profileCardDismissed = '1'`, hides card

### Component
`components/account/ProfileCompletenessCard.tsx` — `'use client'` component (uses `sessionStorage` and `router`).

```ts
interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness;
}
```

---

## Feature 3 — Nudge in CarriereCard

### Trigger
Shown inside the existing CarriereCard component when `score < 100`.

### UI
- Yellow badge (`#f59e0b`, white text, `border-2 border-white`) on the avatar: shows `missingFields.length`. Hidden when `missingFields.length === 0`.
- Progress block below the avatar/name row (hidden when `score === 100`):
  - Label "Profiel volledigheid" + score `%` (right-aligned, `#02554d`)
  - Thin progress bar (`#02554d`, h-1.5, rounded)
  - Dynamic missing-fields sentence (see below)
  - Link: "Profiel aanvullen →" → `router.push('/account/settings')`

### Dynamic missing-fields sentence

Format: "Voeg [list] toe om je profiel compleet te maken."

Build `[list]` from `missingFields` using display labels:
- 1 field: `een **Avatar**`
- 2 fields: `een **Avatar** en **Geboortedatum**`
- 3+ fields: `**Avatar**, **Geboortedatum** en **Voornaam**` (join all with `, `, replace last `, ` with ` en `; no "een" prefix; no comma before "en")

### Data sync after in-card avatar upload

`CarriereCard` already handles avatar uploads internally (calls `updateUser` on success). After a successful upload, `AccountPageContent` must re-fetch user data so the `completeness` prop is updated.

To enable this, hoist `fetchUserData` from inside the `useEffect` in `AccountPageContent` into component scope as a `useCallback`:

```ts
const fetchUserData = useCallback(async () => {
  if (!user) return;
  // ... existing fetch logic
}, [user]);

useEffect(() => { fetchUserData(); }, [fetchUserData]);
```

Then update the `onAvatarUpdate` prop on `<CarriereCard>` to call `fetchUserData()` in addition to updating local state:

```ts
onAvatarUpdate={(newUrl) => {
  setUserData((prev: any) => ({ ...prev, avatarUrl: newUrl }));
  fetchUserData();
}}
```

### Implementation note
Add `completeness` as an optional prop to CarriereCard (default: `{ score: 100, missingFields: [] }` for backwards compatibility).

---

## Data flow

```
components/AccountPageContent.tsx  ('use client')
  └── fetchUserData() → GET /api/getUser
        └── getProfileCompleteness(userData)   ← lib/profile/completeness.ts
              ├── <ProfileCompletenessCard completeness={...} />       (feature 2)
              └── <CarriereCard completeness={...} onAvatarUpdate={fetchUserData} ... />  (feature 3)
```

---

## Registration flow change

In `app/api/createUser/route.ts`, add `onboardingShown: false` to the `db.collection('users').doc(uid).set({...})` call:

```ts
await db.collection('users').doc(uid).set({
  email,
  playername,
  onboardingShown: false,   // ← add this line
  // ... all existing fields unchanged
});
```

---

## Firestore changes

New fields written to `users/{uid}`:

| Field | Type | Notes |
|---|---|---|
| `onboardingShown` | `boolean` | `false` at registration; `true` after onboarding is shown/dismissed |
| `firstName` | `string` | Optional |
| `lastName` | `string` | Optional |
| `dateOfBirth` | `string` | Format `YYYY-MM-DD`, optional |
| `preferredLanguage` | `'nl' \| 'en'` | Optional |

Existing fields `avatarUrl`, `playername`, `email` are unchanged.

---

## Out of scope

- Email notifications / push nudges
- Gamification (badges, rewards)
- Admin dashboard for completion rates
- Forcing users to complete profile (always optional)
- Clearing / deleting previously filled fields via the onboarding form
