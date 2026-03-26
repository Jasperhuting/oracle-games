# Forum Activity & Notifications — Design Spec

**Date:** 2026-03-26
**Status:** Approved

## Overview

Two related features to drive forum engagement:

1. **ForumActivityCard** — a new card on the account dashboard showing recent forum topics from games the user participates in.
2. **Forum email notifications** — direct email when someone replies to a topic you posted in; daily digest for new topics in your games. Both can be disabled per-user in profile settings.

---

## Scope

### In scope
- `ForumActivityCard` component on account page
- `GET /api/forum/activity-summary` API route
- `useForumActivitySummary` hook
- Direct reply notification triggered in existing replies POST route
- Daily digest via Vercel cron endpoint `GET /api/cron/forum-digest`
- Two opt-out toggles in `/account/settings` — added to `AccountInfoTab` under a new "Forumnotificaties" sub-heading
- User preference fields on Firestore `users` document
- `forumNotifications` field whitelisted in `POST /api/updateUser` (regular profile path only)
- `lib/forum/notifications.ts` — shared helper for all forum email sending

### Out of scope
- Push notifications (browser/mobile)
- Per-topic notification subscriptions
- Firebase Cloud Functions
- Notification history / notification centre

---

## Data Model

### User document (Firestore `users/{uid}`)

Add the following nested field. Both keys are **always written together** on save (never partial update):

```ts
forumNotifications?: {
  replyOnMyTopic: boolean   // default: true — direct email on reply
  dailyDigest: boolean      // default: true — morning digest of new topics
}
```

**Default behaviour:** absent field = treat as `{ replyOnMyTopic: true, dailyDigest: true }`. No migration needed for existing users.

When a toggle is changed in settings, always write the full object with both keys:
```ts
{ forumNotifications: { replyOnMyTopic: <value>, dailyDigest: <value> } }
```

### `forum_topics` collection (relevant fields)

```
gameId, createdBy, title, createdAt (Timestamp), lastReplyAt (Timestamp),
replyCount, lastReplyPreview
```

### `gameParticipants` collection (relevant fields)

```
userId, gameId, joinedAt (Timestamp)
```

---

## Shared Email Helper — `lib/forum/notifications.ts`

All forum email sending (both reply notifications and digest) lives here. Exports:

```ts
sendReplyNotifications(opts: {
  topicId: string
  topicTitle: string
  topicCreatedBy: string
  replyerId: string
  replyPreview: string
}): Promise<void>

sendDigestEmail(opts: {
  email: string
  preferredLanguage: string
  topics: DigestTopic[]
}): Promise<void>
```

Both functions use Resend. Both include a 600ms `await delay(600)` between each send call to respect the 2 req/s rate limit.

Email HTML is inline hardcoded strings inside this file — not stored in Firestore.

---

## API Routes

### `GET /api/forum/activity-summary`

**Auth:** session cookie (`userHandler`)
**Purpose:** Returns up to 5 recent forum topics from games the user participates in.

**Logic:**
1. Fetch user's game IDs from `gameParticipants` where `userId == uid` (one-time `getDocs`, no snapshot)
2. If no games → return `{ topics: [] }`
3. Firestore `in` queries are capped at 30 items. If `gameIds.length > 30`, cap to the 30 most recent by `joinedAt DESC`. If future growth beyond 30 games is needed, switch to `Promise.all` of per-gameId queries.
4. Query `forum_topics` where `gameId in [gameIds]`, order by `lastReplyAt DESC`, limit 20
5. Fetch game names: query `games` collection by the relevant `gameIds`, build a `Map<gameId, gameName>`
6. Deduplicate by `gameId`; keep most recent topic per game; take top 5
7. Serialise Firestore Timestamps via `.toDate().toISOString()`
8. Return: `{ topics: ForumActivityItem[] }`

```ts
interface ForumActivityItem {
  topicId: string
  title: string
  gameId: string
  gameName: string
  lastReplyAt: string      // ISO timestamp
  replyCount: number
  lastReplyPreview: string | null
}
```

---

### `GET /api/cron/forum-digest`

**Auth:** `Authorization: Bearer <CRON_SECRET>` header (env var `CRON_SECRET`)
**Duration:** `export const maxDuration = 300` in the route file (same pattern as `send-message-notifications`)
**Schedule:** daily at 08:00 UTC (`vercel.json` crons entry — no `functions` override needed)
**Purpose:** Sends one digest email per eligible user.

**Logic:**
1. Calculate `since = now - 24h`
2. Query `forum_topics` where `createdAt > since` (Firestore Timestamp comparison)
3. Group topics by `gameId`
4. Query `gameParticipants` for those `gameId`s → build map `gameId → [userId]`
5. Collect unique affected `userId`s
6. For each affected user:
   a. Fetch `users/{uid}` — get email, preferredLanguage, `forumNotifications`, `forumDigestSentAt`
   b. Skip if: no email | `forumNotifications.dailyDigest === false` | `forumDigestSentAt` within last 20 hours
   c. Filter out topics created by the user themselves
   d. If 0 topics remain → skip
   e. Cap to 10 topics (most recent first)
   f. Call `sendDigestEmail(...)` from `lib/forum/notifications.ts`
   g. Write `forumDigestSentAt: FieldValue.serverTimestamp()` to user's doc (idempotency)
7. Return `{ sent: number, skipped: number }`

---

### Modification: `POST /api/forum/topics/[topicId]/replies`

After saving the reply and updating the topic doc, add at the end of the route:

```ts
void sendReplyNotifications({
  topicId,
  topicTitle: topicDoc.data()!.title,
  topicCreatedBy: topicDoc.data()!.createdBy,
  replyerId: userId,       // from request body — used only to exclude from notifications
  replyPreview: preview,
}).catch(console.error);
```

**`sendReplyNotifications` implementation (`lib/forum/notifications.ts`):**
1. Fetch all `forum_replies` where `topicId == topicId` → collect distinct `createdBy` values
2. Add `topicCreatedBy` to the set
3. Remove `replyerId`
4. For each participant uid:
   - Fetch `users/{uid}` — get email + `forumNotifications`
   - Skip if no email or `forumNotifications.replyOnMyTopic === false`
   - Send reply notification email via Resend; await 600ms before next
5. **Known limitation:** fetches all replies on a topic (unbounded). Acceptable for current scale. Future optimisation: maintain a `topicParticipants` sub-collection.

**Security note:** `userId` comes from the request body (route has no session auth). It is only used to exclude the poster from their own notifications — no security risk.

---

### Modification: `POST /api/updateUser`

Add `forumNotifications` to the **regular profile update path only** (not the admin `updates` spread path). Follow the same pattern as the existing `emailNotifications` field:

1. Destructure `forumNotifications` from `body` alongside other profile fields
2. Validate before writing:
   ```ts
   if (forumNotifications !== undefined) {
     if (
       typeof forumNotifications !== 'object' ||
       typeof forumNotifications.replyOnMyTopic !== 'boolean' ||
       typeof forumNotifications.dailyDigest !== 'boolean' ||
       Object.keys(forumNotifications).length !== 2
     ) {
       return NextResponse.json({ error: 'Invalid forumNotifications' }, { status: 400 });
     }
     updateData.forumNotifications = forumNotifications;
   }
   ```

---

## Frontend

### `useForumActivitySummary(userId: string | undefined)`

```ts
interface ForumActivitySummary {
  topics: ForumActivityItem[]
  loading: boolean
}
```

- Fetches `GET /api/forum/activity-summary` once on mount
- Returns `{ topics: [], loading: false }` if `userId` is undefined

### `ForumActivityCard`

**Location:** `components/account/ForumActivityCard.tsx`
**Placed in:** `AccountPageContent.tsx` — left column `space-y-6` div, below `InboxPreview`

**UI:**
- Same card shell as `InboxPreview`: `bg-white border border-gray-200 rounded-lg p-6`
- Header: "Forum activiteit" + "Bekijk forum →" link (→ `/forum`)
- Up to 5 topic rows:
  - Topic title (font-medium, truncated)
  - Game name: `text-xs text-gray-400` label below title
  - Relative timestamp right-aligned: today = `HH:mm`, yesterday = "Gisteren", older = `d MMM`
- Loading state: "Laden..."
- Empty state: "Geen recente activiteit in je spellen"

### Settings: `AccountInfoTab`

Add sub-heading **"Forumnotificaties"** below existing notification settings. Two toggle rows following the existing `emailNotifications` checkbox pattern:

| Field | Label | Description |
|-------|-------|-------------|
| `forumNotifications.replyOnMyTopic` | Reacties op mijn topics | Ontvang een e-mail als iemand reageert op een topic waar jij in hebt gepost |
| `forumNotifications.dailyDigest` | Dagelijkse samenvatting | Ontvang elke ochtend een overzicht van nieuwe topics in je spellen |

On toggle change: read both current values, write full `forumNotifications` object to `POST /api/updateUser`. Treat absent field as both `true` when initialising toggle state.

---

## Email Content

### Reply notification (`sendReplyNotifications`)
- **Subject:** `Nieuwe reactie op "[topic title]"`
- **Body:** Who replied, reply preview (first 200 chars), button "Bekijk reactie" → `/forum/topic/[topicId]`
- **Footer:** `Uitschrijven → oracle-games.online/account/settings`

### Daily digest (`sendDigestEmail`)
- **Subject (N=1):** `1 nieuw forumtopic in jouw spellen`
- **Subject (N>1):** `[N] nieuwe forumtopics in jouw spellen`
- **Body:** Topics grouped by game name, each with title + author + link
- **Footer:** `Uitschrijven → oracle-games.online/account/settings`

---

## Vercel Configuration (`vercel.json`)

Add to the existing `crons` array:

```json
{ "path": "/api/cron/forum-digest", "schedule": "0 8 * * *" }
```

No `functions` entry needed — `maxDuration` is set via `export const maxDuration = 300` in the route file.

---

## Implementation Order

1. `lib/forum/notifications.ts` — `sendReplyNotifications` + `sendDigestEmail`
2. `POST /api/updateUser` — whitelist + validate `forumNotifications`
3. Settings toggles in `AccountInfoTab`
4. `GET /api/forum/activity-summary` + `useForumActivitySummary` hook + `ForumActivityCard`
5. Wire `ForumActivityCard` into `AccountPageContent`
6. Reply notification: extend replies POST route
7. `GET /api/cron/forum-digest` + `vercel.json`
