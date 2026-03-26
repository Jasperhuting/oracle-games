# Forum Activity & Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Recent Forum Activity" card to the account dashboard and send email notifications when users get replies or new topics appear in their games.

**Architecture:** A shared `lib/forum/notifications.ts` helper handles all email sending. A new `GET /api/forum/activity-summary` route feeds the frontend card. The daily digest runs as a Vercel cron. All notification preferences are stored on the `users` Firestore document and toggled from `AccountInfoTab`.

**Tech Stack:** Next.js 14 App Router, Firebase Firestore (Admin SDK), Resend, TypeScript, Tailwind CSS, Vercel Cron

---

**Spec:** `docs/superpowers/specs/2026-03-26-forum-activity-notifications-design.md`

---

## Chunk 1: Shared email helper + updateUser whitelist

### Task 1: Create `lib/forum/notifications.ts`

**Files:**
- Create: `lib/forum/notifications.ts`

This file exports two functions used by both the replies route and the cron. Both use Resend with a 600ms delay between sends.

- [ ] **Step 1: Create the file with `sendReplyNotifications`**

```typescript
// lib/forum/notifications.ts
import { Resend } from 'resend';
import { adminDb } from '@/lib/firebase/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://oracle-games.online';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  return new Resend(apiKey);
}

export async function sendReplyNotifications(opts: {
  topicId: string;
  topicTitle: string;
  topicCreatedBy: string;
  replyerId: string;
  replyPreview: string;
}): Promise<void> {
  const { topicId, topicTitle, topicCreatedBy, replyerId, replyPreview } = opts;

  // Collect all participants: topic creator + reply authors
  const repliesSnap = await adminDb
    .collection('forum_replies')
    .where('topicId', '==', topicId)
    .get();

  const participantUids = new Set<string>([topicCreatedBy]);
  for (const doc of repliesSnap.docs) {
    const createdBy = doc.data().createdBy as string | undefined;
    if (createdBy) participantUids.add(createdBy);
  }
  participantUids.delete(replyerId); // never notify the person who just replied

  if (participantUids.size === 0) return;

  const resend = getResend();
  let sendCount = 0;

  for (const uid of participantUids) {
    const userDoc = await adminDb.collection('users').doc(uid).get();
    const userData = userDoc.data();
    if (!userData?.email) continue;
    const prefs = userData.forumNotifications ?? {};
    if (prefs.replyOnMyTopic === false) continue;

    const preview = replyPreview.slice(0, 200);
    const topicUrl = `${BASE_URL}/forum/topic/${topicId}`;

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
        <h2 style="color: #02554d;">Nieuwe reactie op je topic</h2>
        <p>Er is een nieuwe reactie geplaatst op <strong>${topicTitle}</strong>.</p>
        <blockquote style="border-left: 3px solid #02554d; padding-left: 12px; color: #555; margin: 16px 0;">
          ${preview}${preview.length === 200 ? '...' : ''}
        </blockquote>
        <a href="${topicUrl}" style="display:inline-block;background:#02554d;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600;">
          Bekijk reactie
        </a>
        <p style="margin-top: 24px; font-size: 12px; color: #999;">
          Uitschrijven? Ga naar <a href="${BASE_URL}/account/settings">${BASE_URL}/account/settings</a>
        </p>
      </div>
    `;

    try {
      if (sendCount > 0) await delay(600);
      await resend.emails.send({
        from: 'Oracle Games <no-reply@send.oracle-games.online>',
        to: [userData.email],
        subject: `Nieuwe reactie op "${topicTitle}"`,
        html,
      });
      sendCount++;
    } catch (err) {
      console.error(`[FORUM-NOTIFY] Failed to send reply notification to ${uid}:`, err);
    }
  }
}

export interface DigestTopic {
  topicId: string;
  title: string;
  gameName: string;
  createdByName: string;
}

export async function sendDigestEmail(opts: {
  email: string;
  topics: DigestTopic[];
}): Promise<void> {
  const { email, topics } = opts;
  if (topics.length === 0) return;

  const resend = getResend();

  // Group topics by game
  const byGame = new Map<string, DigestTopic[]>();
  for (const t of topics) {
    if (!byGame.has(t.gameName)) byGame.set(t.gameName, []);
    byGame.get(t.gameName)!.push(t);
  }

  const groupsHtml = Array.from(byGame.entries())
    .map(([gameName, gameTopics]) => {
      const topicsHtml = gameTopics
        .map(
          (t) =>
            `<li style="margin-bottom: 6px;">
              <a href="${BASE_URL}/forum/topic/${t.topicId}" style="color: #02554d; font-weight: 600;">${t.title}</a>
              <span style="color: #999; font-size: 12px;"> — door ${t.createdByName}</span>
            </li>`,
        )
        .join('');
      return `<div style="margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #374151;">${gameName}</h3>
        <ul style="padding-left: 20px; margin: 0;">${topicsHtml}</ul>
      </div>`;
    })
    .join('');

  const n = topics.length;
  const subject =
    n === 1
      ? `1 nieuw forumtopic in jouw spellen`
      : `${n} nieuwe forumtopics in jouw spellen`;

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
      <h2 style="color: #02554d;">${subject}</h2>
      <p>In de afgelopen 24 uur zijn er nieuwe topics geplaatst in jouw spellen:</p>
      ${groupsHtml}
      <p style="margin-top: 24px; font-size: 12px; color: #999;">
        Uitschrijven? Ga naar <a href="${BASE_URL}/account/settings">${BASE_URL}/account/settings</a>
      </p>
    </div>
  `;

  await resend.emails.send({
    from: 'Oracle Games <no-reply@send.oracle-games.online>',
    to: [email],
    subject,
    html,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/forum/notifications.ts
git commit -m "feat: add forum email notification helpers"
```

---

### Task 2: Whitelist `forumNotifications` in `POST /api/updateUser`

**Files:**
- Modify: `app/api/updateUser/route.ts` (regular profile path, lines ~9 and ~129)

- [ ] **Step 1: Add `forumNotifications` to destructuring (line 9)**

Change:
```typescript
const { userId, playername, firstName, lastName, dateOfBirth, preferredLanguage, emailNotifications, avatarUrl, updates } = body;
```
To:
```typescript
const { userId, playername, firstName, lastName, dateOfBirth, preferredLanguage, emailNotifications, forumNotifications, avatarUrl, updates } = body;
```

- [ ] **Step 2: Add validation and assignment after the `emailNotifications` line (~line 129)**

After:
```typescript
if (emailNotifications !== undefined) updateData.emailNotifications = emailNotifications;
```
Add:
```typescript
if (forumNotifications !== undefined) {
  if (
    typeof forumNotifications !== 'object' ||
    forumNotifications === null ||
    typeof forumNotifications.replyOnMyTopic !== 'boolean' ||
    typeof forumNotifications.dailyDigest !== 'boolean' ||
    Object.keys(forumNotifications).length !== 2
  ) {
    throw new ApiError('Invalid forumNotifications', 400);
  }
  updateData.forumNotifications = forumNotifications;
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/updateUser/route.ts
git commit -m "feat: whitelist forumNotifications in updateUser"
```

---

## Chunk 2: Settings UI toggles

### Task 3: Add notification toggles to `AccountInfoTab`

**Files:**
- Modify: `components/account/AccountInfoTab.tsx`

- [ ] **Step 1: Read the file to find the existing `emailNotifications` toggle pattern**

```bash
grep -n "emailNotifications\|toggle\|checkbox\|notification" components/account/AccountInfoTab.tsx | head -30
```

- [ ] **Step 2: Add local state for forum notification prefs**

Find where `emailNotifications` state is managed. Add alongside it:

```typescript
const [forumReplyNotif, setForumReplyNotif] = useState<boolean>(
  userData?.forumNotifications?.replyOnMyTopic ?? true
);
const [forumDigestNotif, setForumDigestNotif] = useState<boolean>(
  userData?.forumNotifications?.dailyDigest ?? true
);
```

- [ ] **Step 3: Add a save handler for forum prefs**

```typescript
const handleForumNotifChange = async (
  field: 'replyOnMyTopic' | 'dailyDigest',
  value: boolean
) => {
  const next = {
    replyOnMyTopic: field === 'replyOnMyTopic' ? value : forumReplyNotif,
    dailyDigest: field === 'dailyDigest' ? value : forumDigestNotif,
  };
  if (field === 'replyOnMyTopic') setForumReplyNotif(value);
  else setForumDigestNotif(value);

  await fetch('/api/updateUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.uid,
      playername: userData.playername,
      forumNotifications: next,
    }),
  });
};
```

- [ ] **Step 4: Add the UI section below the existing notification settings**

Find the existing `emailNotifications` toggle section and add below it:

```tsx
{/* Forumnotificaties */}
<div className="mt-6">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">Forumnotificaties</h3>
  <div className="space-y-3">
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
        checked={forumReplyNotif}
        onChange={(e) => handleForumNotifChange('replyOnMyTopic', e.target.checked)}
      />
      <div>
        <div className="text-sm font-medium text-gray-900">Reacties op mijn topics</div>
        <div className="text-xs text-gray-500">
          Ontvang een e-mail als iemand reageert op een topic waar jij in hebt gepost
        </div>
      </div>
    </label>
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary"
        checked={forumDigestNotif}
        onChange={(e) => handleForumNotifChange('dailyDigest', e.target.checked)}
      />
      <div>
        <div className="text-sm font-medium text-gray-900">Dagelijkse samenvatting</div>
        <div className="text-xs text-gray-500">
          Ontvang elke ochtend een overzicht van nieuwe topics in je spellen
        </div>
      </div>
    </label>
  </div>
</div>
```

- [ ] **Step 5: Verify the page loads without TypeScript errors**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | grep -i "AccountInfoTab\|forumNotif" | head -20
```

Expected: no errors for these files.

- [ ] **Step 6: Commit**

```bash
git add components/account/AccountInfoTab.tsx
git commit -m "feat: add forum notification toggles to account settings"
```

---

## Chunk 3: ForumActivityCard + API route

### Task 4: `GET /api/forum/activity-summary`

**Files:**
- Create: `app/api/forum/activity-summary/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/forum/activity-summary/route.ts
import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { userHandler } from '@/lib/api/handler';
import { Timestamp } from 'firebase-admin/firestore';

export interface ForumActivityItem {
  topicId: string;
  title: string;
  gameId: string;
  gameName: string;
  lastReplyAt: string;
  replyCount: number;
  lastReplyPreview: string | null;
}

export const GET = userHandler('forum-activity-summary', async (ctx) => {
  const { uid } = ctx;

  // 1. Get user's game IDs
  const participantsSnap = await adminDb
    .collection('gameParticipants')
    .where('userId', '==', uid)
    .orderBy('joinedAt', 'desc')
    .get();

  if (participantsSnap.empty) {
    return { topics: [] };
  }

  // Cap at 30 for Firestore `in` limit
  const gameIds = participantsSnap.docs
    .map((d) => d.data().gameId as string)
    .filter(Boolean)
    .slice(0, 30);

  if (gameIds.length === 0) {
    return { topics: [] };
  }

  // 2. Fetch recent forum topics for these games
  const topicsSnap = await adminDb
    .collection('forum_topics')
    .where('gameId', 'in', gameIds)
    .where('deleted', '!=', true)
    .orderBy('deleted')
    .orderBy('lastReplyAt', 'desc')
    .limit(20)
    .get();

  if (topicsSnap.empty) {
    return { topics: [] };
  }

  // 3. Resolve game names
  const uniqueGameIds = [...new Set(topicsSnap.docs.map((d) => d.data().gameId as string))];
  const gamesSnap = await adminDb
    .collection('games')
    .where('__name__', 'in', uniqueGameIds)
    .get();
  const gameNameMap = new Map<string, string>();
  for (const doc of gamesSnap.docs) {
    gameNameMap.set(doc.id, (doc.data().name as string) || doc.id);
  }

  // 4. Deduplicate: one topic per game, most recent
  const seen = new Set<string>();
  const items: ForumActivityItem[] = [];

  for (const doc of topicsSnap.docs) {
    const data = doc.data();
    const gameId = data.gameId as string;
    if (seen.has(gameId)) continue;
    seen.add(gameId);

    const lastReplyAt =
      data.lastReplyAt instanceof Timestamp
        ? data.lastReplyAt.toDate().toISOString()
        : data.lastReplyAt ?? new Date(0).toISOString();

    items.push({
      topicId: doc.id,
      title: (data.title as string) || '(geen titel)',
      gameId,
      gameName: gameNameMap.get(gameId) || gameId,
      lastReplyAt,
      replyCount: (data.replyCount as number) ?? 0,
      lastReplyPreview: (data.lastReplyPreview as string | null) ?? null,
    });

    if (items.length === 5) break;
  }

  return { topics: items };
});
```

> **Note on the `deleted != true` query:** Firestore requires an `orderBy` on the inequality field when using `!=`. The query above uses `.orderBy('deleted').orderBy('lastReplyAt', 'desc')`. If a composite index for this doesn't exist, Firestore will return an error with a link to create it — follow that link.

- [ ] **Step 2: Check for TypeScript errors**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | grep "activity-summary" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/forum/activity-summary/route.ts
git commit -m "feat: add GET /api/forum/activity-summary route"
```

---

### Task 5: `useForumActivitySummary` hook + `ForumActivityCard`

**Files:**
- Create: `hooks/useForumActivitySummary.ts`
- Create: `components/account/ForumActivityCard.tsx`
- Modify: `components/AccountPageContent.tsx`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/useForumActivitySummary.ts
import { useEffect, useState } from 'react';
import type { ForumActivityItem } from '@/app/api/forum/activity-summary/route';

export interface ForumActivitySummary {
  topics: ForumActivityItem[];
  loading: boolean;
}

export function useForumActivitySummary(userId: string | undefined): ForumActivitySummary {
  const [topics, setTopics] = useState<ForumActivityItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch('/api/forum/activity-summary')
      .then((r) => (r.ok ? r.json() : { topics: [] }))
      .then((data) => setTopics(data.topics ?? []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, [userId]);

  return { topics, loading };
}
```

- [ ] **Step 2: Create `ForumActivityCard`**

```tsx
// components/account/ForumActivityCard.tsx
'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useForumActivitySummary } from '@/hooks/useForumActivitySummary';
import { MessageCircle } from 'tabler-icons-react';

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Gisteren';
  }
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

export function ForumActivityCard() {
  const { user } = useAuth();
  const { topics, loading } = useForumActivitySummary(user?.uid);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-2">
        <h2 className="text-lg font-bold text-gray-900">Forum activiteit</h2>
        <Link href="/forum" className="text-sm text-primary hover:underline">
          Bekijk forum →
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Laden...</p>
      ) : topics.length === 0 ? (
        <p className="text-sm text-gray-400">Geen recente activiteit in je spellen</p>
      ) : (
        <ul className="space-y-2">
          {topics.map((topic) => (
            <li key={topic.topicId}>
              <Link
                href={`/forum/topic/${topic.topicId}`}
                className="flex items-start gap-2 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{topic.title}</p>
                  <p className="text-xs text-gray-400">{topic.gameName}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                  {formatRelativeTime(topic.lastReplyAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire into `AccountPageContent.tsx`**

Add import at the top:
```typescript
import { ForumActivityCard } from './account/ForumActivityCard';
```

In the left column, after `<InboxPreview />`:
```tsx
{/* Forum activiteit */}
<ForumActivityCard />
```

- [ ] **Step 4: TypeScript check**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | grep -i "ForumActivity\|forum-activity" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add hooks/useForumActivitySummary.ts components/account/ForumActivityCard.tsx components/AccountPageContent.tsx
git commit -m "feat: add ForumActivityCard to account dashboard"
```

---

## Chunk 4: Reply notifications + daily digest cron

### Task 6: Wire reply notification into the replies route

**Files:**
- Modify: `app/api/forum/topics/[topicId]/replies/route.ts`

- [ ] **Step 1: Add import at the top of the file**

```typescript
import { sendReplyNotifications } from '@/lib/forum/notifications';
```

- [ ] **Step 2: Add fire-and-forget call after the topic update**

The existing update at line ~39 is:
```typescript
await topicDocRef.update({ ... });
```

Immediately after that block, add:
```typescript
// Fire-and-forget forum reply notification (does not block response)
void sendReplyNotifications({
  topicId,
  topicTitle: topicDoc.data()!.title as string ?? '',
  topicCreatedBy: topicDoc.data()!.createdBy as string ?? '',
  replyerId: userId,
  replyPreview: preview,
}).catch((err) => console.error('[FORUM-NOTIFY] sendReplyNotifications error:', err));
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | grep "replies/route" | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/forum/topics/\[topicId\]/replies/route.ts
git commit -m "feat: send email notification on forum reply"
```

---

### Task 7: Daily digest cron

**Files:**
- Create: `app/api/cron/forum-digest/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the cron route**

```typescript
// app/api/cron/forum-digest/route.ts
import { NextRequest } from 'next/server';
import { adminDb } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { sendDigestEmail, DigestTopic } from '@/lib/forum/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('[FORUM-DIGEST] Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const results = { sent: 0, skipped: 0, errors: [] as string[] };

  try {
    const now = new Date();
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sinceTimestamp = Timestamp.fromDate(since);
    const twentyHoursAgo = Timestamp.fromDate(new Date(now.getTime() - 20 * 60 * 60 * 1000));

    // 1. Fetch new topics from last 24h
    const newTopicsSnap = await adminDb
      .collection('forum_topics')
      .where('createdAt', '>', sinceTimestamp)
      .get();

    if (newTopicsSnap.empty) {
      console.log('[FORUM-DIGEST] No new topics in last 24h');
      return Response.json({ success: true, ...results });
    }

    // 2. Group by gameId
    const topicsByGame = new Map<string, typeof newTopicsSnap.docs>();
    for (const doc of newTopicsSnap.docs) {
      const gameId = doc.data().gameId as string;
      if (!gameId) continue;
      if (!topicsByGame.has(gameId)) topicsByGame.set(gameId, []);
      topicsByGame.get(gameId)!.push(doc);
    }

    const affectedGameIds = [...topicsByGame.keys()];
    if (affectedGameIds.length === 0) {
      return Response.json({ success: true, ...results });
    }

    // 3. Find participants of affected games
    // Firestore `in` cap: process in batches of 30
    const userIdSet = new Set<string>();
    for (let i = 0; i < affectedGameIds.length; i += 30) {
      const batch = affectedGameIds.slice(i, i + 30);
      const participantsSnap = await adminDb
        .collection('gameParticipants')
        .where('gameId', 'in', batch)
        .get();
      for (const doc of participantsSnap.docs) {
        const uid = doc.data().userId as string;
        if (uid) userIdSet.add(uid);
      }
    }

    // 4. Resolve game names once
    const gameNameMap = new Map<string, string>();
    for (let i = 0; i < affectedGameIds.length; i += 30) {
      const batch = affectedGameIds.slice(i, i + 30);
      const gamesSnap = await adminDb
        .collection('games')
        .where('__name__', 'in', batch)
        .get();
      for (const doc of gamesSnap.docs) {
        gameNameMap.set(doc.id, (doc.data().name as string) || doc.id);
      }
    }

    // 5. Per-user processing
    let sendIndex = 0;
    for (const uid of userIdSet) {
      try {
        const userDoc = await adminDb.collection('users').doc(uid).get();
        const userData = userDoc.data();

        if (!userData?.email) { results.skipped++; continue; }
        if (userData.forumNotifications?.dailyDigest === false) { results.skipped++; continue; }

        // Idempotency: skip if digest was already sent in last 20h
        if (userData.forumDigestSentAt && userData.forumDigestSentAt > twentyHoursAgo) {
          results.skipped++;
          continue;
        }

        // Build topic list for this user (exclude topics they created; cap at 10)
        const userTopics: DigestTopic[] = [];
        for (const [gameId, docs] of topicsByGame) {
          for (const doc of docs) {
            const data = doc.data();
            if (data.createdBy === uid) continue; // skip own topics
            userTopics.push({
              topicId: doc.id,
              title: (data.title as string) || '(geen titel)',
              gameName: gameNameMap.get(gameId) || gameId,
              createdByName: (data.createdByName as string) || 'Onbekend',
            });
          }
        }

        if (userTopics.length === 0) { results.skipped++; continue; }

        // Sort by createdAt desc, cap at 10
        const cappedTopics = userTopics.slice(0, 10);

        if (dryRun) {
          console.log(`[FORUM-DIGEST] DRY-RUN: Would send digest to ${userData.email} (${cappedTopics.length} topics)`);
          results.sent++;
          continue;
        }

        if (sendIndex > 0) await delay(600);

        await sendDigestEmail({ email: userData.email, topics: cappedTopics });

        // Mark as sent (idempotency)
        await adminDb.collection('users').doc(uid).update({
          forumDigestSentAt: FieldValue.serverTimestamp(),
        });

        results.sent++;
        sendIndex++;
        console.log(`[FORUM-DIGEST] Sent digest to ${userData.email}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        console.error(`[FORUM-DIGEST] Error for user ${uid}:`, msg);
        results.errors.push(`${uid}: ${msg}`);
      }
    }

    console.log('[FORUM-DIGEST] Complete', results);
    return Response.json({ success: true, ...results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[FORUM-DIGEST] Fatal error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add cron entry to `vercel.json`**

In `vercel.json`, add to the `crons` array:
```json
{
  "path": "/api/cron/forum-digest",
  "schedule": "0 8 * * *"
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | grep "forum-digest\|forum/notifications" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/forum-digest/route.ts vercel.json
git commit -m "feat: add daily forum digest cron"
```

---

## Final TypeScript check

- [ ] **Run full TypeScript check**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games" && npx tsc --noEmit 2>&1 | head -40
```

Expected: 0 errors. If errors exist, fix before proceeding.

- [ ] **Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve TypeScript errors in forum notifications"
```
