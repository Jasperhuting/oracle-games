# Feedback Survey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toon een modal popup aan ingelogde gebruikers met open feedbackvragen over de website; sla antwoorden op in Firestore; toon overzicht in de admin.

**Architecture:** Een `SurveyModal` component wordt gerenderd vanuit `AppShellProviders` en controleert via een custom hook of de gebruiker al heeft deelgenomen aan de actieve ronde. De actieve ronde wordt bepaald door een constante in `lib/constants/survey.ts`. Antwoorden worden via een API route opgeslagen in Firestore collectie `survey_responses`. Een admin-pagina leest de antwoorden op en toont ze in een tabel.

**Tech Stack:** Next.js App Router, Firebase Firestore (admin SDK server-side, client SDK client-side), React hooks, react-hot-toast

---

## Bestandsoverzicht

| Bestand | Actie | Verantwoordelijkheid |
|---|---|---|
| `lib/constants/survey.ts` | Aanmaken | Ronde ID en vragendefinities |
| `lib/types/survey.ts` | Aanmaken | TypeScript types voor survey |
| `hooks/useSurveyStatus.ts` | Aanmaken | Controleert of gebruiker modal moet zien |
| `components/SurveyModal.tsx` | Aanmaken | Modal UI met stap-voor-stap vragen |
| `app/api/survey/route.ts` | Aanmaken | POST endpoint: sla antwoord/skip op in Firestore |
| `app/api/survey/admin/route.ts` | Aanmaken | GET endpoint: haal alle antwoorden op (admin) |
| `app/admin/survey/page.tsx` | Aanmaken | Admin-pagina met overzichtstabel |
| `components/AppShellProviders.tsx` | Wijzigen | Voeg `<SurveyModal />` toe |

---

## Task 1: Types en constanten

**Files:**
- Create: `lib/constants/survey.ts`
- Create: `lib/types/survey.ts`

- [ ] **Stap 1: Maak `lib/types/survey.ts` aan**

```typescript
export interface SurveyAnswers {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
}

export interface SurveyResponse {
  userId: string;
  userName: string;
  roundId: string;
  skipped: boolean;
  answers: SurveyAnswers;
  submittedAt: string; // ISO string aan client-kant
}

export interface SurveyQuestion {
  id: keyof SurveyAnswers;
  text: string;
  placeholder: string;
}
```

- [ ] **Stap 2: Maak `lib/constants/survey.ts` aan**

```typescript
import type { SurveyQuestion } from '@/lib/types/survey';

export const SURVEY_ROUND_ID = '2026-Q2';

export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'q1',
    text: 'Wat mis je nog op de website?',
    placeholder: 'Bijv. meer statistieken, een mobiele app...',
  },
  {
    id: 'q2',
    text: 'Gebruik je het forum? Wat zou het beter maken?',
    placeholder: 'Bijv. betere notificaties, meer categorieën...',
  },
  {
    id: 'q3',
    text: 'Mis je nog spellen die je graag zou willen spelen?',
    placeholder: 'Bijv. een ander type fantasy spel...',
  },
  {
    id: 'q4',
    text: 'Heb je nog andere feedback of suggesties?',
    placeholder: 'Alles wat je kwijt wilt...',
  },
];
```

- [ ] **Stap 3: Commit**

```bash
git add lib/types/survey.ts lib/constants/survey.ts
git commit -m "feat: add survey types and constants"
```

---

## Task 2: API route voor opslaan van antwoorden

**Files:**
- Create: `app/api/survey/route.ts`

- [ ] **Stap 1: Maak de API route aan**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { SurveyAnswers } from '@/lib/types/survey';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userName, roundId, skipped, answers } = body as {
      userId: string;
      userName: string;
      roundId: string;
      skipped: boolean;
      answers: SurveyAnswers;
    };

    if (!userId || !roundId) {
      return NextResponse.json({ error: 'userId en roundId zijn verplicht' }, { status: 400 });
    }

    const docId = `${userId}_${roundId}`;
    const docRef = adminDb.collection('survey_responses').doc(docId);
    const existing = await docRef.get();

    if (existing.exists) {
      return NextResponse.json({ error: 'Al eerder ingevuld voor deze ronde' }, { status: 409 });
    }

    await docRef.set({
      userId,
      userName: userName || 'Onbekend',
      roundId,
      skipped: skipped ?? false,
      answers: answers ?? { q1: '', q2: '', q3: '', q4: '' },
      submittedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving survey response:', error);
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }
}
```

- [ ] **Stap 2: Test de route handmatig via curl (na stap 4 van Task 3 wanneer de app draait)**

```bash
curl -X POST http://localhost:3000/api/survey \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","userName":"Test","roundId":"2026-Q2","skipped":false,"answers":{"q1":"test","q2":"","q3":"","q4":""}}'
# Verwacht: {"success":true}
```

- [ ] **Stap 3: Commit**

```bash
git add app/api/survey/route.ts
git commit -m "feat: add survey POST API route"
```

---

## Task 3: Hook voor controleren survey-status

**Files:**
- Create: `hooks/useSurveyStatus.ts`

De hook leest Firestore client-side (geen API call nodig) om te bepalen of de modal getoond moet worden.

- [ ] **Stap 1: Maak `hooks/useSurveyStatus.ts` aan**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { SURVEY_ROUND_ID } from '@/lib/constants/survey';

export function useSurveyStatus(userId: string | undefined) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const docId = `${userId}_${SURVEY_ROUND_ID}`;
    getDoc(doc(db, 'survey_responses', docId))
      .then((snap) => {
        setShouldShow(!snap.exists());
      })
      .catch(() => {
        setShouldShow(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { shouldShow, loading };
}
```

- [ ] **Stap 2: Commit**

```bash
git add hooks/useSurveyStatus.ts
git commit -m "feat: add useSurveyStatus hook"
```

---

## Task 4: SurveyModal component

**Files:**
- Create: `components/SurveyModal.tsx`

- [ ] **Stap 1: Maak `components/SurveyModal.tsx` aan**

```typescript
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSurveyStatus } from '@/hooks/useSurveyStatus';
import { SURVEY_QUESTIONS, SURVEY_ROUND_ID } from '@/lib/constants/survey';
import type { SurveyAnswers } from '@/lib/types/survey';

const QUESTIONS_PER_PAGE = 2;

export function SurveyModal() {
  const { user } = useAuth();
  const { shouldShow, loading } = useSurveyStatus(user?.uid);
  const [visible, setVisible] = useState(true);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({ q1: '', q2: '', q3: '', q4: '' });
  const [submitting, setSubmitting] = useState(false);

  if (loading || !shouldShow || !visible || !user) return null;

  const totalPages = Math.ceil(SURVEY_QUESTIONS.length / QUESTIONS_PER_PAGE);
  const currentQuestions = SURVEY_QUESTIONS.slice(
    page * QUESTIONS_PER_PAGE,
    (page + 1) * QUESTIONS_PER_PAGE
  );
  const isLastPage = page === totalPages - 1;

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email || 'Onbekend',
          roundId: SURVEY_ROUND_ID,
          skipped: true,
          answers: { q1: '', q2: '', q3: '', q4: '' },
        }),
      });
    } catch {
      // Stille fout: popup sluiten ook als opslaan mislukt
    } finally {
      setVisible(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email || 'Onbekend',
          roundId: SURVEY_ROUND_ID,
          skipped: false,
          answers,
        }),
      });
      if (res.ok) {
        toast.success('Bedankt voor je feedback!');
        setVisible(false);
      } else {
        toast.error('Opslaan mislukt, probeer het later opnieuw.');
      }
    } catch {
      toast.error('Opslaan mislukt, probeer het later opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--platform-card-bg,#1a1a2e)] rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Help ons de website verbeteren</h2>
            <p className="text-sm text-gray-400 mt-1">Duurt maar 2 minuten. Je kunt ook overslaan.</p>
          </div>
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="text-gray-500 hover:text-gray-300 text-2xl leading-none ml-4"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <div className="border-t border-gray-700 mb-5" />

        {currentQuestions.map((q, i) => (
          <div key={q.id} className="mb-5">
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
              Vraag {page * QUESTIONS_PER_PAGE + i + 1} van {SURVEY_QUESTIONS.length}
            </p>
            <p className="font-medium mb-2">{q.text}</p>
            <textarea
              value={answers[q.id]}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder={q.placeholder}
              disabled={submitting}
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-sm resize-y min-h-[80px] focus:outline-none focus:border-blue-500"
            />
          </div>
        ))}

        <div className="flex justify-between items-center mt-2">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg px-4 py-2"
          >
            Overslaan, doe niet mee
          </button>
          <div className="flex gap-2">
            {page > 0 && (
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={submitting}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
              >
                Vorige
              </button>
            )}
            {isLastPage ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm"
              >
                {submitting ? 'Versturen...' : 'Verstuur'}
              </button>
            ) : (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm"
              >
                Volgende
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 justify-center mt-4">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-7 rounded-full transition-colors ${i <= page ? 'bg-blue-500' : 'bg-gray-700'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Stap 2: Commit**

```bash
git add components/SurveyModal.tsx
git commit -m "feat: add SurveyModal component"
```

---

## Task 5: Integreer SurveyModal in AppShellProviders

**Files:**
- Modify: `components/AppShellProviders.tsx`

- [ ] **Stap 1: Voeg de import toe bovenaan het bestand**

Voeg toe bij de andere imports:
```typescript
import { SurveyModal } from '@/components/SurveyModal';
```

- [ ] **Stap 2: Voeg `<SurveyModal />` toe na de bestaande niet-publieke componenten**

In de JSX, direct na `{!isPublic && <MessageNotification />}`, voeg toe:
```tsx
{!isPublic && <SurveyModal />}
```

Het blok ziet er daarna zo uit:
```tsx
{!isPublic && <LastActiveTracker />}
{!isPublic && <MessageNotification />}
{!isPublic && <SurveyModal />}
```

- [ ] **Stap 3: Controleer dat de app start zonder fouten**

```bash
npm run dev
# Open http://localhost:3000, log in en controleer of de popup verschijnt
```

- [ ] **Stap 4: Commit**

```bash
git add components/AppShellProviders.tsx
git commit -m "feat: integrate SurveyModal into AppShellProviders"
```

---

## Task 6: Admin API route voor ophalen antwoorden

**Files:**
- Create: `app/api/survey/admin/route.ts`

- [ ] **Stap 1: Maak de admin GET route aan**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { requireAdmin, toAdminErrorResponse } from '@/lib/auth/requireAdmin';
import type { SurveyResponse } from '@/lib/types/survey';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const snapshot = await adminDb
      .collection('survey_responses')
      .orderBy('submittedAt', 'desc')
      .get();

    const responses: SurveyResponse[] = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        ...data,
        submittedAt: data.submittedAt?.toDate().toISOString() ?? '',
      } as SurveyResponse;
    });

    return NextResponse.json({ responses });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
```

- [ ] **Stap 2: Commit**

```bash
git add app/api/survey/admin/route.ts
git commit -m "feat: add survey admin GET API route"
```

---

## Task 7: Admin-pagina voor survey overzicht

**Files:**
- Create: `app/admin/survey/page.tsx`

- [ ] **Stap 1: Maak `app/admin/survey/page.tsx` aan**

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS } from '@/lib/constants/survey';
import type { SurveyResponse } from '@/lib/types/survey';

export default function SurveyAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetch(`/api/getUser?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.userType === 'admin') setIsAdmin(true);
        else router.push('/home');
      })
      .catch(() => router.push('/home'))
      .finally(() => setChecking(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/survey/admin')
      .then((r) => r.json())
      .then((data) => setResponses(data.responses ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (authLoading || checking) return <p className="p-8 text-center">Laden...</p>;

  const participated = responses.filter((r) => !r.skipped);
  const skipped = responses.filter((r) => r.skipped);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Feedback Survey</h1>
      <p className="text-gray-400 mb-6">
        {participated.length} ingevuld, {skipped.length} overgeslagen
      </p>

      {loading && <p className="text-gray-400">Laden...</p>}

      {!loading && participated.length === 0 && (
        <p className="text-gray-400">Nog geen antwoorden ontvangen.</p>
      )}

      {participated.map((r) => (
        <div key={`${r.userId}_${r.roundId}`} className="border border-gray-700 rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold">{r.userName}</span>
            <span className="text-xs text-gray-500">
              {r.submittedAt ? new Date(r.submittedAt).toLocaleString('nl-NL') : ''}
            </span>
          </div>
          {SURVEY_QUESTIONS.map((q) => (
            <div key={q.id} className="mb-3">
              <p className="text-xs text-gray-400 mb-1">{q.text}</p>
              <p className="text-sm">{r.answers[q.id] || <span className="text-gray-600">Geen antwoord</span>}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Stap 2: Controleer of de pagina werkt**

Open `http://localhost:3000/admin/survey` als admin en controleer dat de antwoorden zichtbaar zijn.

- [ ] **Stap 3: Commit**

```bash
git add app/admin/survey/page.tsx
git commit -m "feat: add survey admin overview page"
```

---

## Task 8: Popup vertraging toevoegen

De modal moet 2 seconden wachten na het laden om de pagina eerst te laten renderen.

**Files:**
- Modify: `components/SurveyModal.tsx`

- [ ] **Stap 1: Voeg een `delayed` state toe aan SurveyModal**

Vervang de huidige state-declaraties:
```typescript
const [visible, setVisible] = useState(true);
const [page, setPage] = useState(0);
const [answers, setAnswers] = useState<SurveyAnswers>({ q1: '', q2: '', q3: '', q4: '' });
const [submitting, setSubmitting] = useState(false);
```

Door:
```typescript
const [visible, setVisible] = useState(true);
const [delayed, setDelayed] = useState(false);
const [page, setPage] = useState(0);
const [answers, setAnswers] = useState<SurveyAnswers>({ q1: '', q2: '', q3: '', q4: '' });
const [submitting, setSubmitting] = useState(false);

useEffect(() => {
  const timer = setTimeout(() => setDelayed(true), 2000);
  return () => clearTimeout(timer);
}, []);
```

- [ ] **Stap 2: Voeg `delayed` toe aan de early-return check**

Vervang:
```typescript
if (loading || !shouldShow || !visible || !user) return null;
```

Door:
```typescript
if (loading || !shouldShow || !visible || !delayed || !user) return null;
```

- [ ] **Stap 3: Commit**

```bash
git add components/SurveyModal.tsx
git commit -m "feat: add 2 second delay to survey modal"
```

---

## Checklist na implementatie

- [ ] Popup verschijnt 2 seconden na inloggen op een niet-publieke pagina
- [ ] "Overslaan, doe niet mee" sluit de popup en slaat `skipped: true` op
- [ ] Na het invullen en versturen verdwijnt de popup en toont een toast
- [ ] Popup verschijnt niet opnieuw bij volgende inlog (zelfde ronde)
- [ ] Admin-pagina `/admin/survey` toont ingevulde antwoorden per gebruiker
- [ ] Niet-admins zien "Geen toegang" op de admin-pagina
