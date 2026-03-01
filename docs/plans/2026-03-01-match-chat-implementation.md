# Match Chat Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Real-time wedstrijd-chatrooms met Firestore onSnapshot, admin-beheer, automatische sluiting, emoji reacties, replies en moderatie.

**Architecture:** Firestore subcollections (`chat_rooms/{roomId}/messages` en `chat_rooms/{roomId}/muted_users`) met client-side `onSnapshot` listeners. Admin API routes voor CRUD. Cron job voor auto-close. Alle data in de default Firestore database.

**Tech Stack:** Next.js 15, Firebase Firestore (client `onSnapshot` + admin SDK), TypeScript, Tailwind CSS, react-countdown, @tabler/icons-react.

---

### Task 1: Types

**Files:**
- Create: `lib/types/chat.ts`

**Step 1: Create type definitions**

```typescript
// lib/types/chat.ts
import { Timestamp } from 'firebase/firestore';

export type ChatRoomStatus = 'open' | 'closed';
export type ChatGameType = 'football' | 'f1' | 'cycling' | null;

export interface ChatRoom {
  id: string;
  title: string;
  description?: string;
  gameType?: ChatGameType;
  closesAt: Timestamp | string;
  createdAt: Timestamp | string;
  createdBy: string;
  status: ChatRoomStatus;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  userAvatar?: string | null;
  replyTo?: {
    messageId: string;
    userName: string;
    text: string;
  } | null;
  reactions: Record<string, string[]>;
  deleted: boolean;
  createdAt: Timestamp | string;
}

export interface ChatMutedUser {
  userId: string;
  mutedBy: string;
  mutedUntil: Timestamp | string;
  reason?: string;
}
```

**Step 2: Commit**

```bash
git add lib/types/chat.ts
git commit -m "feat(chat): add type definitions for chat rooms, messages, and muted users"
```

---

### Task 2: Firestore Security Rules

**Files:**
- Modify: `firestore.rules` (insert before line 229, the default deny rule)

**Step 1: Add chat security rules**

Insert the following block in `firestore.rules` after the System collection section (after line 227), before the default deny:

```
    // ========================================================================
    // MATCH CHAT
    // ========================================================================

    // Chat Rooms - authenticated users can read, admins manage
    match /chat_rooms/{roomId} {
      allow read: if request.auth != null;
      allow create: if isAdmin();
      allow update: if isAdmin();
      allow delete: if isAdmin();

      // Messages - authenticated users can read and create in open rooms
      match /messages/{messageId} {
        allow read: if request.auth != null;
        allow create: if request.auth != null
                        && request.resource.data.userId == request.auth.uid
                        && get(/databases/$(database)/documents/chat_rooms/$(roomId)).data.status == 'open';
        allow update: if isAdmin();
        allow delete: if false;
      }

      // Muted users - only admins
      match /muted_users/{mutedId} {
        allow read: if request.auth != null;
        allow write: if isAdmin();
      }
    }
```

**Step 2: Commit**

```bash
git add firestore.rules
git commit -m "feat(chat): add Firestore security rules for chat rooms"
```

---

### Task 3: Admin API — Chat Rooms CRUD

**Files:**
- Create: `app/api/chat/rooms/route.ts` (GET all rooms, POST create room)
- Create: `app/api/chat/rooms/[roomId]/route.ts` (GET single, PATCH update, DELETE)

**Step 1: Create GET/POST rooms route**

`app/api/chat/rooms/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET: List all chat rooms
export async function GET() {
  try {
    const snapshot = await db.collection('chat_rooms').orderBy('createdAt', 'desc').get();
    const rooms = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title,
        description: data.description || null,
        gameType: data.gameType || null,
        closesAt: data.closesAt?.toDate?.()?.toISOString() || data.closesAt,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        createdBy: data.createdBy,
        status: data.status,
        messageCount: data.messageCount || 0,
      };
    });
    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    return NextResponse.json({ error: 'Failed to fetch chat rooms' }, { status: 500 });
  }
}

// POST: Create a new chat room (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, gameType, closesAt, createdBy } = body;

    if (!title || !closesAt || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: title, closesAt, createdBy' },
        { status: 400 }
      );
    }

    const roomData = {
      title,
      description: description || null,
      gameType: gameType || null,
      closesAt: Timestamp.fromDate(new Date(closesAt)),
      createdAt: Timestamp.now(),
      createdBy,
      status: 'open',
      messageCount: 0,
    };

    const docRef = await db.collection('chat_rooms').add(roomData);
    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error creating chat room:', error);
    return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
  }
}
```

**Step 2: Create single room route**

`app/api/chat/rooms/[roomId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// GET: Single chat room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const doc = await db.collection('chat_rooms').doc(roomId).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const data = doc.data()!;
    return NextResponse.json({
      id: doc.id,
      title: data.title,
      description: data.description || null,
      gameType: data.gameType || null,
      closesAt: data.closesAt?.toDate?.()?.toISOString() || data.closesAt,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      createdBy: data.createdBy,
      status: data.status,
      messageCount: data.messageCount || 0,
    });
  } catch (error) {
    console.error('Error fetching chat room:', error);
    return NextResponse.json({ error: 'Failed to fetch chat room' }, { status: 500 });
  }
}

// PATCH: Update chat room (status, closesAt, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.status !== undefined) updates.status = body.status;
    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.closesAt !== undefined) updates.closesAt = Timestamp.fromDate(new Date(body.closesAt));

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db.collection('chat_rooms').doc(roomId).update(updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating chat room:', error);
    return NextResponse.json({ error: 'Failed to update chat room' }, { status: 500 });
  }
}

// DELETE: Delete chat room and all subcollections
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;

    // Delete messages subcollection
    const messagesSnapshot = await db.collection(`chat_rooms/${roomId}/messages`).get();
    const batch = db.batch();
    messagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete muted_users subcollection
    const mutedSnapshot = await db.collection(`chat_rooms/${roomId}/muted_users`).get();
    mutedSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    // Delete the room itself
    batch.delete(db.collection('chat_rooms').doc(roomId));
    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting chat room:', error);
    return NextResponse.json({ error: 'Failed to delete chat room' }, { status: 500 });
  }
}
```

**Step 3: Commit**

```bash
git add app/api/chat/rooms/route.ts app/api/chat/rooms/\[roomId\]/route.ts
git commit -m "feat(chat): add admin API routes for chat room CRUD"
```

---

### Task 4: Messages API — Send & Moderate

**Files:**
- Create: `app/api/chat/rooms/[roomId]/messages/route.ts` (POST send message)
- Create: `app/api/chat/rooms/[roomId]/messages/[messageId]/route.ts` (PATCH for delete/reactions)
- Create: `app/api/chat/rooms/[roomId]/mute/route.ts` (POST mute user)

**Step 1: Create messages route**

`app/api/chat/rooms/[roomId]/messages/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST: Send a message
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { text, userId, userName, userAvatar, replyTo } = body;

    if (!text?.trim() || !userId || !userName) {
      return NextResponse.json(
        { error: 'Missing required fields: text, userId, userName' },
        { status: 400 }
      );
    }

    // Check room is open
    const roomDoc = await db.collection('chat_rooms').doc(roomId).get();
    if (!roomDoc.exists) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }
    const roomData = roomDoc.data()!;
    if (roomData.status === 'closed') {
      return NextResponse.json({ error: 'Chat is closed' }, { status: 403 });
    }
    const closesAt = roomData.closesAt?.toDate?.() || new Date(roomData.closesAt);
    if (closesAt <= new Date()) {
      return NextResponse.json({ error: 'Chat has expired' }, { status: 403 });
    }

    // Check if user is muted
    const mutedSnapshot = await db
      .collection(`chat_rooms/${roomId}/muted_users`)
      .where('userId', '==', userId)
      .where('mutedUntil', '>', Timestamp.now())
      .limit(1)
      .get();
    if (!mutedSnapshot.empty) {
      return NextResponse.json({ error: 'You are muted' }, { status: 403 });
    }

    const messageData = {
      text: text.trim(),
      userId,
      userName,
      userAvatar: userAvatar || null,
      replyTo: replyTo || null,
      reactions: {},
      deleted: false,
      createdAt: Timestamp.now(),
    };

    const docRef = await db.collection(`chat_rooms/${roomId}/messages`).add(messageData);

    // Increment message count
    await db.collection('chat_rooms').doc(roomId).update({
      messageCount: FieldValue.increment(1),
    });

    return NextResponse.json({ id: docRef.id });
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
```

**Step 2: Create message update route (delete, reactions)**

`app/api/chat/rooms/[roomId]/messages/[messageId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// PATCH: Update message (soft delete or toggle reaction)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  try {
    const { roomId, messageId } = await params;
    const body = await request.json();
    const msgRef = db.doc(`chat_rooms/${roomId}/messages/${messageId}`);

    // Soft delete (admin only — enforced by caller)
    if (body.deleted === true) {
      await msgRef.update({ deleted: true });
      return NextResponse.json({ success: true });
    }

    // Toggle reaction
    if (body.reaction && body.userId) {
      const { reaction, userId } = body;
      const msgDoc = await msgRef.get();
      if (!msgDoc.exists) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 });
      }
      const reactions = msgDoc.data()!.reactions || {};
      const users: string[] = reactions[reaction] || [];

      if (users.includes(userId)) {
        // Remove reaction
        await msgRef.update({
          [`reactions.${reaction}`]: FieldValue.arrayRemove(userId),
        });
      } else {
        // Add reaction
        await msgRef.update({
          [`reactions.${reaction}`]: FieldValue.arrayUnion(userId),
        });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'No valid action provided' }, { status: 400 });
  } catch (error) {
    console.error('Error updating message:', error);
    return NextResponse.json({ error: 'Failed to update message' }, { status: 500 });
  }
}
```

**Step 3: Create mute route**

`app/api/chat/rooms/[roomId]/mute/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST: Mute a user (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const body = await request.json();
    const { userId, mutedBy, durationMinutes, reason } = body;

    if (!userId || !mutedBy || !durationMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, mutedBy, durationMinutes' },
        { status: 400 }
      );
    }

    const mutedUntil = new Date(Date.now() + durationMinutes * 60 * 1000);

    await db.collection(`chat_rooms/${roomId}/muted_users`).add({
      userId,
      mutedBy,
      mutedUntil: Timestamp.fromDate(mutedUntil),
      reason: reason || null,
    });

    return NextResponse.json({ success: true, mutedUntil: mutedUntil.toISOString() });
  } catch (error) {
    console.error('Error muting user:', error);
    return NextResponse.json({ error: 'Failed to mute user' }, { status: 500 });
  }
}
```

**Step 4: Commit**

```bash
git add app/api/chat/rooms/\[roomId\]/messages/ app/api/chat/rooms/\[roomId\]/mute/
git commit -m "feat(chat): add API routes for messages, reactions, and moderation"
```

---

### Task 5: Cron Job — Auto-close Expired Rooms

**Files:**
- Create: `app/api/cron/close-expired-chats/route.ts`
- Modify: `vercel.json` (add cron entry)

**Step 1: Create cron route**

`app/api/cron/close-expired-chats/route.ts`:

```typescript
import { NextRequest } from 'next/server';
import { adminDb as db } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (authHeader !== expectedAuth) {
      console.error('[CRON] Unauthorized access to close-expired-chats');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Checking for expired chat rooms');

    const now = Timestamp.now();
    const snapshot = await db
      .collection('chat_rooms')
      .where('status', '==', 'open')
      .where('closesAt', '<=', now)
      .get();

    let closed = 0;
    for (const doc of snapshot.docs) {
      await doc.ref.update({ status: 'closed' });
      closed++;
      console.log(`[CRON] Closed chat room: ${doc.id} (${doc.data().title})`);
    }

    console.log(`[CRON] Closed ${closed} expired chat rooms`);
    return Response.json({ success: true, closed });
  } catch (error) {
    console.error('[CRON] Error closing expired chats:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Add cron to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{
  "path": "/api/cron/close-expired-chats",
  "schedule": "*/5 * * * *"
}
```

**Step 3: Commit**

```bash
git add app/api/cron/close-expired-chats/route.ts vercel.json
git commit -m "feat(chat): add cron job to auto-close expired chat rooms"
```

---

### Task 6: Client Hook — useChatRoom & useChatMessages

**Files:**
- Create: `hooks/useChatRoom.ts`
- Create: `hooks/useChatMessages.ts`

**Step 1: Create useChatRoom hook**

`hooks/useChatRoom.ts` — Listens to a single chat room document for real-time status updates:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

export function useChatRoom(roomId: string) {
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, 'chat_rooms', roomId),
      (snapshot) => {
        if (snapshot.exists()) {
          setRoom({ id: snapshot.id, ...snapshot.data() } as ChatRoom);
        } else {
          setRoom(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to chat room:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  return { room, loading, error };
}
```

**Step 2: Create useChatMessages hook**

`hooks/useChatMessages.ts` — Listens to messages subcollection with real-time updates:

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  endBefore,
  limitToLast,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatMessage } from '@/lib/types/chat';

const PAGE_SIZE = 100;

export function useChatMessages(roomId: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [oldestDoc, setOldestDoc] = useState<QueryDocumentSnapshot | null>(null);

  // Real-time listener for latest messages
  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `chat_rooms/${roomId}/messages`),
      orderBy('createdAt', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs = snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
          .reverse(); // Oldest first for display
        setMessages(msgs);
        setHasMore(snapshot.docs.length >= PAGE_SIZE);
        if (snapshot.docs.length > 0) {
          setOldestDoc(snapshot.docs[snapshot.docs.length - 1]); // Last doc = oldest
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to messages:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!roomId || !oldestDoc) return;

    const q = query(
      collection(db, `chat_rooms/${roomId}/messages`),
      orderBy('createdAt', 'desc'),
      endBefore(oldestDoc),
      limitToLast(PAGE_SIZE)
    );

    const snapshot = await getDocs(q);
    const olderMsgs = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as ChatMessage))
      .reverse();

    setMessages((prev) => [...olderMsgs, ...prev]);
    setHasMore(snapshot.docs.length >= PAGE_SIZE);
    if (snapshot.docs.length > 0) {
      setOldestDoc(snapshot.docs[snapshot.docs.length - 1]);
    }
  }, [roomId, oldestDoc]);

  return { messages, loading, error, hasMore, loadMore };
}
```

**Step 3: Commit**

```bash
git add hooks/useChatRoom.ts hooks/useChatMessages.ts
git commit -m "feat(chat): add real-time hooks for chat room and messages"
```

---

### Task 7: Chat Overview Page — `/chat`

**Files:**
- Create: `app/chat/page.tsx`

**Step 1: Build overview page**

`app/chat/page.tsx` — Lists open and recently closed chat rooms. Fetches via API (not real-time, overview doesn't need it). Shows cards with title, gameType badge, message count, countdown to close.

Key elements:
- Fetch rooms from `GET /api/chat/rooms`
- Filter: open rooms first, then recently closed (last 7 days)
- Each card: title, description, gameType badge (color-coded), messageCount, closesAt with `react-countdown`
- Click navigates to `/chat/[roomId]`
- Wrap in auth check using `useAuth()` — redirect to login if not authenticated

Reference patterns:
- Page structure: same as `app/forum/page.tsx` (breadcrumb, gradient header, grid of cards)
- Auth check: `const { user, loading } = useAuth()`
- Icons: `@tabler/icons-react` (IconMessageCircle, IconLock, IconClock)

**Step 2: Commit**

```bash
git add app/chat/page.tsx
git commit -m "feat(chat): add chat rooms overview page"
```

---

### Task 8: Chat Room Page — `/chat/[roomId]`

**Files:**
- Create: `app/chat/[roomId]/page.tsx`
- Create: `components/chat/ChatMessageList.tsx`
- Create: `components/chat/ChatInput.tsx`
- Create: `components/chat/ChatMessageItem.tsx`
- Create: `components/chat/EmojiReactions.tsx`

**Step 1: Build ChatMessageItem component**

`components/chat/ChatMessageItem.tsx` — Single message display:
- Avatar (use existing AvatarBadge pattern from `components/forum/AvatarBadge.tsx` or simple initials circle)
- Username + timestamp
- Reply-to block (if `replyTo` exists): gray box above message with quoted text
- Message text
- Emoji reactions row (EmojiReactions component)
- Reply button + admin-only delete button
- Soft-deleted messages show "Dit bericht is verwijderd" in italic

**Step 2: Build EmojiReactions component**

`components/chat/EmojiReactions.tsx`:
- Show existing reactions as pills: emoji + count
- Clicking toggles your reaction (calls `PATCH /api/chat/rooms/[roomId]/messages/[messageId]` with `{ reaction, userId }`)
- "+" button to add a new reaction from a small emoji picker (simple predefined set: thumbsup, heart, laugh, fire, eyes, 100)

**Step 3: Build ChatInput component**

`components/chat/ChatInput.tsx`:
- Text input + send button
- When replying: show reply preview above input with close button
- Disabled state when room is closed (show "Deze chat is gesloten")
- Disabled state when user is muted (show "Je bent gedempt tot [time]")
- Calls `POST /api/chat/rooms/[roomId]/messages` to send

**Step 4: Build ChatMessageList component**

`components/chat/ChatMessageList.tsx`:
- Scrollable container with auto-scroll to bottom on new messages
- "Laad meer berichten" button at top when `hasMore` is true
- Uses `useChatMessages(roomId)` hook
- Renders `ChatMessageItem` for each message

**Step 5: Build the room page**

`app/chat/[roomId]/page.tsx`:
- Header: room title, countdown timer (`react-countdown` to `closesAt`), status badge (open/closed)
- `ChatMessageList` component
- `ChatInput` component at bottom
- Uses `useChatRoom(roomId)` for real-time room status
- Uses `useAuth()` for user info
- Admin badge next to admin usernames in chat

**Step 6: Commit**

```bash
git add app/chat/\[roomId\]/page.tsx components/chat/
git commit -m "feat(chat): add chat room page with real-time messages, replies, and reactions"
```

---

### Task 9: Admin Chat Management — `/admin/chat`

**Files:**
- Create: `app/admin/chat/page.tsx`

**Step 1: Build admin page**

`app/admin/chat/page.tsx`:

Key elements:
- Admin gate: same pattern as `app/admin/races/page.tsx` (check userType === 'admin')
- Breadcrumb: Home > Admin > Chat Management
- "Nieuwe chat aanmaken" button that opens a form:
  - Title (required)
  - Description (optional)
  - GameType dropdown: Football, F1, Cycling, Algemeen
  - Sluitdatum + tijd (date+time picker, default: today 23:59)
  - Submit calls `POST /api/chat/rooms`
- Table of all rooms (use `@tanstack/react-table` if helpful, or simple table):
  - Columns: Title, GameType, Status (badge), Messages, Sluit op, Acties
  - Actions: Sluiten/Heropenen toggle, Verwijderen (with confirmation)
  - Sluiten calls `PATCH /api/chat/rooms/[roomId]` with `{ status: 'closed' }`
  - Heropenen calls `PATCH /api/chat/rooms/[roomId]` with `{ status: 'open' }`
  - Verwijderen calls `DELETE /api/chat/rooms/[roomId]`
- Link to the actual chat room for inline moderation

**Step 2: Commit**

```bash
git add app/admin/chat/page.tsx
git commit -m "feat(chat): add admin chat management page"
```

---

### Task 10: Admin Moderation in Chat Room

**Files:**
- Modify: `components/chat/ChatMessageItem.tsx` (add admin actions)
- Create: `components/chat/MuteUserDialog.tsx`

**Step 1: Add admin actions to ChatMessageItem**

When the current user is an admin, show:
- Delete button (trash icon) → calls `PATCH /api/chat/rooms/[roomId]/messages/[messageId]` with `{ deleted: true }`
- Mute button (volume-off icon) → opens MuteUserDialog

**Step 2: Build MuteUserDialog**

`components/chat/MuteUserDialog.tsx`:
- Simple modal/dropdown with mute duration options: 15 min, 1 uur, rest van de chat
- Optional reason field
- Calls `POST /api/chat/rooms/[roomId]/mute`

**Step 3: Commit**

```bash
git add components/chat/ChatMessageItem.tsx components/chat/MuteUserDialog.tsx
git commit -m "feat(chat): add admin moderation (delete messages, mute users)"
```

---

### Task 11: Navigation & Integration

**Files:**
- Modify: navigation component (find the main nav/sidebar to add a "Chat" link)
- Modify: `app/admin/page.tsx` (add link to chat admin)

**Step 1: Add chat link to main navigation**

Find the main navigation component and add a "Chat" link pointing to `/chat`. Use `IconMessageCircle` from `@tabler/icons-react`.

**Step 2: Add chat admin link to admin dashboard**

In `app/admin/page.tsx`, add a card/link to "Chat Management" pointing to `/admin/chat`.

**Step 3: Commit**

```bash
git add [modified navigation files]
git commit -m "feat(chat): add chat links to navigation and admin dashboard"
```

---

### Task 12: Testing & Verification

**Step 1: Manual test checklist**

Run the app locally and verify:
- [ ] Admin can create a chat room from `/admin/chat`
- [ ] Chat room appears on `/chat` overview
- [ ] Users can send messages in real-time
- [ ] Messages appear instantly for other users (open two browser tabs)
- [ ] Reply-to functionality works
- [ ] Emoji reactions toggle correctly
- [ ] Admin can delete messages (shows "Dit bericht is verwijderd")
- [ ] Admin can mute users
- [ ] Muted users cannot send messages
- [ ] Chat auto-closes when `closesAt` passes (test with a short time)
- [ ] Closed chats show as read-only
- [ ] Admin can manually close/reopen chats
- [ ] Multiple chat rooms can be open simultaneously

**Step 2: Deploy Firestore rules**

```bash
firebase deploy --only firestore:rules
```

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat(chat): complete match chat feature with real-time messaging"
```
