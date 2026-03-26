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
- Daily digest via Vercel cron endpoint `POST /api/cron/forum-digest`
- Two opt-out toggles in `/account/settings` under "Forumnotificaties"
- User preference fields on Firestore `users` document

### Out of scope
- Push notifications (browser/mobile)
- Per-topic notification subscriptions
- Firebase Cloud Functions
- Notification history / notification centre

---

## Data Model

### User document (Firestore `users/{uid}`)

Add the following field (defaults to `true` for all notification types):

```ts
forumNotifications?: {
  replyOnMyTopic: boolean   // default: true — direct email on reply
  dailyDigest: boolean      // default: true — morning digest of new topics
}
```

Missing field = treat as `true` (opt-in by default, no migration needed).

---

## API Routes

### `GET /api/forum/activity-summary`

**Auth:** session cookie (userHandler)
**Purpose:** Returns up to 5 recent forum topics from games the user participates in.

**Logic:**
1. Fetch user's game IDs from `gameParticipants` where `userId == uid` (one-time read, no snapshot)
2. If no games → return `{ topics: [] }`
3. Query `forum_topics` where `gameId in [gameIds]`, order by `lastReplyAt DESC`, limit 20
4. Deduplicate by `gameId` to avoid one game dominating; return top 5
5. Return: `{ topics: ForumActivityItem[] }`

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

**Performance:** both queries are one-time reads (`getDocs`), no `onSnapshot`.

---

### `POST /api/cron/forum-digest`

**Auth:** `Authorization: Bearer <CRON_SECRET>` header (env var `CRON_SECRET`)
**Schedule:** daily at 08:00 (configured in `vercel.json`)
**Purpose:** Sends one digest email per user who has `forumNotifications.dailyDigest !== false` and has unseen new topics in their games since yesterday.

**Logic:**
1. Calculate `since = now - 24h`
2. Query all `forum_topics` where `createdAt > since` (new topics only, not replies)
3. Group topics by `gameId`
4. Query all `gameParticipants` to build a map of `gameId → [userId]`
5. For each affected user:
   a. Check `forumNotifications.dailyDigest !== false`
   b. Collect topics for their games
   c. Fetch user's email + preferred language from `users` doc
   d. Send digest email via Resend
6. Return `{ sent: number, skipped: number }`

**Guards:**
- Skip users with no email
- Skip topics created by the user themselves
- Max 10 topics per digest email (most recent first)

---

### Modification: `POST /api/forum/topics/[topicId]/replies`

After saving the reply, trigger direct notifications:

1. Fetch all previous participants in the topic:
   - The topic creator (`forum_topics.createdBy`)
   - All users who have posted a reply (`forum_replies` where `topicId == topicId`, distinct `createdBy`)
2. Exclude the user who just posted the reply
3. For each participant: check `forumNotifications.replyOnMyTopic !== false`
4. Send direct email via Resend with topic title, reply preview, and link to topic
5. This is fire-and-forget (`void sendReplyNotification(...).catch(console.error)`) — do not block the response

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
- No polling, no `onSnapshot`

### `ForumActivityCard`

**Location:** `components/account/ForumActivityCard.tsx`
**Placed in:** `AccountPageContent.tsx` — left column, below `InboxPreview`

**UI:**
- Same card shell as `InboxPreview` (white, border, rounded-lg, p-6)
- Header: "Forum activiteit" + "Bekijk forum" link (→ `/forum`)
- Up to 5 topic rows, each showing:
  - Topic title (bold, truncated)
  - Game name as a small grey label
  - Relative timestamp (today = time, yesterday = "Gisteren", older = date)
- Empty state: "Geen recente activiteit in je spellen"
- Loading state: "Laden..."

### Settings page (`/account/settings`)

Add a new section **"Forumnotificaties"** with two toggle rows:

| Toggle | Label | Description |
|--------|-------|-------------|
| `replyOnMyTopic` | Reacties op mijn topics | Ontvang een e-mail als iemand reageert op een topic waar jij in hebt gepost |
| `dailyDigest` | Dagelijkse samenvatting | Ontvang elke ochtend een overzicht van nieuwe topics in je spellen |

Both default to `true`. Saved immediately on toggle (PATCH to existing user update endpoint).

---

## Email Templates

### Reply notification
- **Subject:** `Nieuwe reactie op "[topic title]"`
- **Body:** Who replied, preview of the reply (first 200 chars), button "Bekijk reactie" → `/forum/topic/[topicId]`
- **Unsubscribe line:** "Uitschrijven voor deze notificaties → /account/settings"

### Daily digest
- **Subject:** `[N] nieuwe forumtopics in jouw spellen`
- **Body:** List of new topics grouped by game name, each with title + author + link
- **Unsubscribe line:** "Uitschrijven voor digest → /account/settings"

Both emails are sent via Resend using the existing `lib/email` infrastructure. Templates are hardcoded strings (not stored in Firestore) for simplicity.

---

## Vercel Cron Configuration

In `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/forum-digest",
      "schedule": "0 8 * * *"
    }
  ]
}
```

The route validates `Authorization: Bearer ${process.env.CRON_SECRET}`.

---

## Implementation Order

1. User preference fields + settings toggles
2. `GET /api/forum/activity-summary` + hook + `ForumActivityCard`
3. Direct reply notification in replies route
4. Daily digest cron route + `vercel.json`
