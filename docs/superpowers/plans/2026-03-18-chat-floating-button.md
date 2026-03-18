# Chat Floating Button Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a floating chat button (FAB) to every authenticated page that opens a compact popup overlay with real-time chat, expandable to a side drawer, with a link to the full chat page.

**Architecture:** A single self-contained client component `ChatFloatingButton` is mounted once in `AppShellProviders` inside the authenticated shell. It owns all overlay state (open/closed, popup/drawer, selected room) and is fed room data from a new `useChatRooms` hook. Unread counts are tracked via `localStorage`. Existing `useChatMessages`, `ChatMessageItem`, and `ChatInput` components are reused with minimal changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Firebase client SDK (`onSnapshot`), Tailwind CSS, `@tabler/icons-react`, `useAuth` hook.

---

## Chunk 1: Data layer — `useChatRooms` hook

### Task 1: Create `hooks/useChatRooms.ts`

**Files:**
- Create: `hooks/useChatRooms.ts`
- Test: `tests/unit/useChatRooms.test.ts`

The hook subscribes to all `chat_rooms` documents where `status === 'open'`, computes per-room unread counts from `localStorage`, and exposes `totalUnread`.

**Unread logic:**
- `localStorage` key: `chat_unread_${roomId}` — stores the `messageCount` value at the last time that room was opened.
- Unread for a room: `Math.max(0, room.messageCount - (lastSeen ?? room.messageCount))`.
- `lastSeen ?? room.messageCount` means: on first visit (no key), baseline = current count → unread starts at 0.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/useChatRooms.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeUnreadCounts } from '@/hooks/useChatRooms';

describe('computeUnreadCounts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns 0 for all rooms on first visit (no localStorage key)', () => {
    const rooms = [
      { id: 'room1', messageCount: 10 },
      { id: 'room2', messageCount: 5 },
    ];
    const result = computeUnreadCounts(rooms as any);
    expect(result.get('room1')).toBe(0);
    expect(result.get('room2')).toBe(0);
  });

  it('returns unread count when messageCount has grown since last seen', () => {
    localStorage.setItem('chat_unread_room1', '7');
    const rooms = [{ id: 'room1', messageCount: 10 }];
    const result = computeUnreadCounts(rooms as any);
    expect(result.get('room1')).toBe(3); // 10 - 7
  });

  it('never returns negative unread count', () => {
    localStorage.setItem('chat_unread_room1', '15');
    const rooms = [{ id: 'room1', messageCount: 10 }];
    const result = computeUnreadCounts(rooms as any);
    expect(result.get('room1')).toBe(0);
  });

  it('computes totalUnread as sum across all rooms', () => {
    localStorage.setItem('chat_unread_room1', '7');
    localStorage.setItem('chat_unread_room2', '3');
    const rooms = [
      { id: 'room1', messageCount: 10 },
      { id: 'room2', messageCount: 5 },
    ];
    const result = computeUnreadCounts(rooms as any);
    const total = Array.from(result.values()).reduce((a, b) => a + b, 0);
    expect(total).toBe(5); // room1: 10-7=3, room2: 5-3=2 → total 5
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
/opt/homebrew/bin/node node_modules/.bin/vitest run tests/unit/useChatRooms.test.ts
```
Expected: FAIL — `computeUnreadCounts` not found.

- [ ] **Step 3: Implement `hooks/useChatRooms.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import type { ChatRoom } from '@/lib/types/chat';

export interface UseChatRoomsResult {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  totalUnread: number;
  loading: boolean;
}

/** Exported for unit testing. Computes per-room unread counts from localStorage. */
export function computeUnreadCounts(rooms: ChatRoom[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const room of rooms) {
    const stored = localStorage.getItem(`chat_unread_${room.id}`);
    const lastSeen = stored !== null ? parseInt(stored, 10) : room.messageCount;
    map.set(room.id, Math.max(0, room.messageCount - lastSeen));
  }
  return map;
}

/** Call this when a user opens a room to mark all current messages as seen. */
export function markRoomAsSeen(roomId: string, messageCount: number): void {
  localStorage.setItem(`chat_unread_${roomId}`, String(messageCount));
}

export function useChatRooms(): UseChatRoomsResult {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'chat_rooms'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as ChatRoom)
        );
        const counts = computeUnreadCounts(fetched);
        setRooms(fetched);
        setUnreadByRoom(counts);
        setLoading(false);
      },
      (err) => {
        console.error('[useChatRooms] Firestore error:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const totalUnread = Array.from(unreadByRoom.values()).reduce((a, b) => a + b, 0);

  return { rooms, unreadByRoom, totalUnread, loading };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
/opt/homebrew/bin/node node_modules/.bin/vitest run tests/unit/useChatRooms.test.ts
```
Expected: PASS (4 tests).

- [ ] **Step 5: TypeScript check**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep useChatRooms
```
Expected: no output (no errors).

- [ ] **Step 6: Commit**

```bash
git add hooks/useChatRooms.ts tests/unit/useChatRooms.test.ts
git commit -m "feat: add useChatRooms hook with unread count tracking"
```

---

## Chunk 2: ChatInput `compact` prop

### Task 2: Add `compact` prop to `ChatInput`

**Files:**
- Modify: `components/chat/ChatInput.tsx`

When `compact={true}`, the Giphy picker button is hidden. All other functionality (emoji, send, reply preview) remains.

- [ ] **Step 1: Add `compact` to the props interface**

In `components/chat/ChatInput.tsx`, find the `ChatInputProps` interface and add the optional prop:

```typescript
interface ChatInputProps {
  roomId: string;
  user: {
    uid: string;
    displayName: string | null;
    photoURL?: string | null;
  };
  replyingTo: ReplyTo | null;
  onClearReply: () => void;
  disabled: boolean;
  disabledReason?: string;
  compact?: boolean; // ← add this line
}
```

Also destructure it in the function signature:
```typescript
export default function ChatInput({
  roomId,
  user,
  replyingTo,
  onClearReply,
  disabled,
  disabledReason,
  compact = false, // ← add this line
}: ChatInputProps) {
```

- [ ] **Step 2: Conditionally hide the Giphy button**

Search for the Giphy button render in the component (look for `showGiphyPicker` or a GIF icon). Wrap **only the button JSX** with `{!compact && ( ... )}`:

```tsx
{!compact && (
  <button
    type="button"
    onClick={() => setShowGiphyPicker(true)}
    // ... existing props
  >
    {/* existing GIF icon */}
  </button>
)}
```

Also wrap the GiphyPicker portal render with `{!compact && ( ... )}` if it renders separately from the button.

**Important — do NOT remove refs or state:** `giphyButtonRef`, `giphyPickerRef`, `showGiphyPicker`, `giphyPickerPos`, and their associated `useEffect` must remain in place unchanged. When `compact={true}`, the button is never rendered so `showGiphyPicker` can never become `true` — the refs being null is harmless. Removing them would break the outside-click handler for the existing non-compact usage.

- [ ] **Step 3: TypeScript check**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep ChatInput
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/chat/ChatInput.tsx
git commit -m "feat: add compact prop to ChatInput that hides Giphy button"
```

---

## Chunk 3: `ChatFloatingButton` component

### Task 3: Build `components/chat/ChatFloatingButton.tsx`

**Files:**
- Create: `components/chat/ChatFloatingButton.tsx`

This is the main component. It contains all overlay state and renders: the FAB, the room list, and the message view — in both popup and drawer layouts.

**Component structure** (all in one file, using internal sub-components):

```
ChatFloatingButton          ← root, owns all state
  ├── FAB                   ← always rendered (when rooms exist + not on /chat)
  ├── ChatPopup             ← rendered when isOpen && mode === 'popup'
  │     └── OverlayContent  ← shared: room list or message view
  └── ChatDrawer            ← rendered when isOpen && mode === 'drawer'
        └── OverlayContent  ← same shared component
```

- [ ] **Step 1: Create the file with FAB + basic toggle**

Create `components/chat/ChatFloatingButton.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { IconMessage, IconX, IconArrowRight, IconArrowsDiagonal, IconArrowsDiagonalMinimize, IconExternalLink, IconChevronLeft } from '@tabler/icons-react';
import { useChatRooms, markRoomAsSeen } from '@/hooks/useChatRooms';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useAuth } from '@/hooks/useAuth';
import ChatMessageItem from './ChatMessageItem';
import ChatInput from './ChatInput';
import type { ChatRoom } from '@/lib/types/chat';

type OverlayMode = 'popup' | 'drawer';

export default function ChatFloatingButton() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { rooms, unreadByRoom, totalUnread, loading } = useChatRooms();

  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<OverlayMode>('popup');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const fabRef = useRef<HTMLButtonElement>(null);

  // Hide on chat pages and when no open rooms
  const isOnChatPage = pathname.startsWith('/chat');
  const hasRooms = rooms.length > 0;

  // Auto-select room if only one
  useEffect(() => {
    if (isOpen && rooms.length === 1 && selectedRoomId === null) {
      setSelectedRoomId(rooms[0].id);
    }
  }, [isOpen, rooms, selectedRoomId]);

  const openOverlay = () => {
    setIsOpen(true);
    if (rooms.length === 1) {
      handleSelectRoom(rooms[0]);
    }
  };

  const closeOverlay = () => {
    setIsOpen(false);
    setMode('popup');
    setSelectedRoomId(null);
  };

  const handleSelectRoom = (room: ChatRoom) => {
    setSelectedRoomId(room.id);
    markRoomAsSeen(room.id, room.messageCount);
  };

  const handleBackToList = () => {
    setSelectedRoomId(null);
  };

  const handleGoToFullPage = () => {
    if (selectedRoomId) {
      router.push(`/chat/${selectedRoomId}`);
    } else {
      router.push('/chat');
    }
    closeOverlay();
  };

  if (loading || !hasRooms || !user || isOnChatPage) return null;

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  return (
    <>
      {/* FAB */}
      <button
        ref={fabRef}
        onClick={() => (isOpen ? closeOverlay() : openOverlay())}
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors"
        aria-label="Open chat"
      >
        {isOpen ? <IconX size={20} /> : <IconMessage size={20} />}
        {!isOpen && totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white ring-2 ring-white">
            {totalUnread > 9 ? '9+' : totalUnread}
          </span>
        )}
      </button>

      {/* Overlay */}
      {isOpen && mode === 'popup' && (
        <ChatPopup
          rooms={rooms}
          unreadByRoom={unreadByRoom}
          selectedRoom={selectedRoom}
          user={user}
          mode={mode}
          onClose={closeOverlay}
          onExpand={() => setMode('drawer')}
          onGoToFullPage={handleGoToFullPage}
          onSelectRoom={handleSelectRoom}
          onBackToList={handleBackToList}
          fabRef={fabRef}
        />
      )}
      {isOpen && mode === 'drawer' && (
        <ChatDrawer
          rooms={rooms}
          unreadByRoom={unreadByRoom}
          selectedRoom={selectedRoom}
          user={user}
          mode={mode}
          onClose={closeOverlay}
          onCollapse={() => setMode('popup')}
          onGoToFullPage={handleGoToFullPage}
          onSelectRoom={handleSelectRoom}
          onBackToList={handleBackToList}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add shared types for overlay sub-components**

Add this interface above `ChatFloatingButton`:

```tsx
interface OverlayProps {
  rooms: ChatRoom[];
  unreadByRoom: Map<string, number>;
  selectedRoom: ChatRoom | null;
  user: { uid: string; displayName: string | null; photoURL?: string | null };
  mode: OverlayMode;
  onClose: () => void;
  onExpand?: () => void;
  onCollapse?: () => void;
  onGoToFullPage: () => void;
  onSelectRoom: (room: ChatRoom) => void;
  onBackToList: () => void;
  fabRef?: React.RefObject<HTMLButtonElement>; // used by ChatPopup to exclude FAB from outside-click
}
```

- [ ] **Step 3: Add `OverlayHeader` sub-component**

Add after the interface:

```tsx
function OverlayHeader({
  selectedRoom,
  rooms,
  mode,
  onClose,
  onExpand,
  onCollapse,
  onGoToFullPage,
  onBackToList,
}: Pick<OverlayProps, 'selectedRoom' | 'rooms' | 'mode' | 'onClose' | 'onExpand' | 'onCollapse' | 'onGoToFullPage' | 'onBackToList'>) {
  const isMultiRoom = rooms.length > 1;
  const showBack = isMultiRoom && selectedRoom !== null;

  return (
    <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2 bg-slate-800 flex-shrink-0">
      {showBack && (
        <button
          onClick={onBackToList}
          className="mr-1 text-slate-400 hover:text-white transition-colors"
          aria-label="Terug naar overzicht"
        >
          <IconChevronLeft size={16} />
        </button>
      )}
      <span className="flex-1 text-sm font-semibold text-slate-100 truncate">
        {selectedRoom ? selectedRoom.title : 'Chats'}
      </span>
      <div className="flex items-center gap-1">
        {mode === 'popup' && onExpand && (
          <button
            onClick={onExpand}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Uitbreiden"
            title="Uitbreiden naar zijpaneel"
          >
            <IconArrowsDiagonal size={15} />
          </button>
        )}
        {mode === 'drawer' && onCollapse && (
          <button
            onClick={onCollapse}
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            aria-label="Minimaliseren"
            title="Terug naar popup"
          >
            <IconArrowsDiagonalMinimize size={15} />
          </button>
        )}
        <button
          onClick={onGoToFullPage}
          className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Volledige pagina"
          title="Open volledige chatpagina"
        >
          <IconExternalLink size={15} />
        </button>
        <button
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          aria-label="Sluiten"
        >
          <IconX size={15} />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `RoomListView` sub-component**

```tsx
function RoomListView({
  rooms,
  unreadByRoom,
  onSelectRoom,
  onGoToFullPage,
}: Pick<OverlayProps, 'rooms' | 'unreadByRoom' | 'onSelectRoom' | 'onGoToFullPage'>) {
  return (
    <div className="flex flex-col flex-1 overflow-y-auto">
      {rooms.map((room) => {
        const unread = unreadByRoom.get(room.id) ?? 0;
        return (
          <button
            key={room.id}
            onClick={() => onSelectRoom(room)}
            className="flex items-center gap-3 px-3 py-3 text-left hover:bg-slate-700 transition-colors border-b border-slate-700/50 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">
                {room.gameType === 'cycling' && '🚴 '}
                {room.gameType === 'football' && '⚽ '}
                {room.gameType === 'f1' && '🏎️ '}
                {room.title}
              </p>
              {/* Note: last-message timestamp is not shown here because ChatRoom has no
                  lastMessageAt field. This is explicitly out of scope for this feature. */}
            </div>
            {unread > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onGoToFullPage}
        className="flex items-center justify-center gap-2 px-3 py-3 text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-700 transition-colors"
      >
        Ga naar overzicht
        <IconArrowRight size={14} />
      </button>
    </div>
  );
}
```

- [ ] **Step 5: Add `RoomChatView` sub-component**

```tsx
function RoomChatView({
  room,
  user,
  compact,
}: {
  room: ChatRoom;
  user: OverlayProps['user'];
  compact: boolean;
}) {
  const { messages, loading } = useChatMessages(room.id);
  const [replyingTo, setReplyingTo] = useState<{ messageId: string; userName: string; text: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isRoomClosed = room.status === 'closed';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 bg-slate-900">
        {loading && (
          <p className="text-xs text-slate-500 text-center py-4">Laden...</p>
        )}
        {!loading && messages.map((msg) => (
          <ChatMessageItem
            key={msg.id}
            message={msg}
            currentUserId={user.uid}
            roomId={room.id}
            onReply={(m) => setReplyingTo({ messageId: m.id, userName: m.userName, text: m.text })}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input or closed notice */}
      {isRoomClosed ? (
        <div className="px-3 py-2 text-xs text-slate-500 text-center border-t border-slate-700 bg-slate-800">
          Deze chat is gesloten.
        </div>
      ) : (
        <ChatInput
          roomId={room.id}
          user={user}
          replyingTo={replyingTo}
          onClearReply={() => setReplyingTo(null)}
          disabled={false}
          compact={compact}
        />
      )}
    </div>
  );
}
```

Note: `useState` and `useRef` are already imported at the top of the file.

- [ ] **Step 6: Add `OverlayContent` sub-component**

```tsx
function OverlayContent(props: OverlayProps & { compact: boolean }) {
  const { rooms, unreadByRoom, selectedRoom, user, compact, onSelectRoom, onGoToFullPage } = props;
  const showRoomList = rooms.length > 1 && selectedRoom === null;

  if (showRoomList) {
    return (
      <RoomListView
        rooms={rooms}
        unreadByRoom={unreadByRoom}
        onSelectRoom={onSelectRoom}
        onGoToFullPage={onGoToFullPage}
      />
    );
  }

  if (selectedRoom) {
    return <RoomChatView room={selectedRoom} user={user} compact={compact} />;
  }

  // Loading/empty state (should not normally be visible)
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-slate-500">
      Geen chat beschikbaar.
    </div>
  );
}
```

- [ ] **Step 7: Add `ChatPopup` sub-component**

```tsx
function ChatPopup(props: OverlayProps) {
  const popupRef = useRef<HTMLDivElement>(null);

  // Close on outside click — exclude the FAB itself (it has its own toggle handler)
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const clickedInsidePopup = popupRef.current?.contains(target);
      const clickedFab = props.fabRef?.current?.contains(target);
      if (!clickedInsidePopup && !clickedFab) {
        props.onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [props.onClose, props.fabRef]);

  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [props.onClose]);

  return (
    <div
      ref={popupRef}
      className="fixed bottom-20 right-5 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-xl bg-slate-800 shadow-2xl overflow-hidden"
      style={{ height: '520px' }}
    >
      <OverlayHeader {...props} />
      <OverlayContent {...props} compact={true} />
    </div>
  );
}
```

- [ ] **Step 8: Add `ChatDrawer` sub-component**

```tsx
function ChatDrawer(props: OverlayProps) {
  // Close on ESC
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [props.onClose]);

  return (
    <>
      {/* Backdrop — clicking collapses back to popup (per spec), not full close */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={props.onCollapse}
      />
      {/* Drawer panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 flex w-[420px] max-w-full flex-col bg-slate-800 shadow-2xl">
        <OverlayHeader {...props} />
        <OverlayContent {...props} compact={false} />
      </div>
    </>
  );
}
```

- [ ] **Step 9: TypeScript check**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | grep ChatFloatingButton
```
Expected: no output.

- [ ] **Step 10: Commit**

```bash
git add components/chat/ChatFloatingButton.tsx
git commit -m "feat: add ChatFloatingButton component with popup and drawer modes"
```

---

## Chunk 4: Mount in AppShellProviders + create test chat room

### Task 4: Mount `ChatFloatingButton` in `AppShellProviders`

**Files:**
- Modify: `components/AppShellProviders.tsx`

- [ ] **Step 1: Import and mount the component**

In `components/AppShellProviders.tsx`, add the import at the top:

```tsx
import ChatFloatingButton from '@/components/chat/ChatFloatingButton';
```

Mount `<ChatFloatingButton />` inside `<AuthGuard>`, in the non-public branch alongside `<LayoutShell>`. This ensures auth is resolved before the component mounts:

```tsx
<AuthGuard>
  {isPublic ? (
    <main>{children}</main>
  ) : (
    <LayoutShell>
      <main>{children}</main>
    </LayoutShell>
  )}
  {!isPublic && <ChatFloatingButton />}   {/* ← add this line */}
</AuthGuard>
```

- [ ] **Step 2: TypeScript check (full project)**

```bash
/opt/homebrew/bin/node node_modules/.bin/tsc --noEmit 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/AppShellProviders.tsx
git commit -m "feat: mount ChatFloatingButton in app shell for all authenticated pages"
```

### Task 5: Create a test chat room via the admin UI

This is a manual step to verify the feature end-to-end before pushing.

- [ ] **Step 1: Start the dev server**

```bash
yarn dev
```

- [ ] **Step 2: Create a test chat room**

Navigate to `/admin/chat` and create a room:
- Title: `Test Chat`
- `closesAt`: set to tomorrow
- Status: `open`

- [ ] **Step 3: Verify FAB appears**

Navigate to any non-chat page (e.g. `/`). Confirm:
- Chat bubble FAB appears bottom-right.
- Clicking opens the popup directly into "Test Chat" (single room → auto-select).
- Messages load and sending works.
- ESC closes the popup.
- ⇥ button expands to drawer.
- ⇤ button collapses back to popup.
- ↗ button navigates to `/chat/[roomId]`.
- FAB does **not** appear on `/chat` or `/chat/[roomId]`.

- [ ] **Step 4: Verify unread count**

Open a second browser tab, send a message. Switch back to first tab — FAB badge should show 1 unread. Opening the chat clears the badge.

- [ ] **Step 5: Push to remote**

```bash
git push
```
