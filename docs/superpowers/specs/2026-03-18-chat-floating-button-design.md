# Chat Floating Button & Overlay — Design Spec
**Date:** 2026-03-18
**Status:** Approved

---

## Overview

A floating action button (FAB) in the bottom-right corner of every authenticated page that lets users open a chat overlay without leaving their current page. Compact popup by default, expandable to side drawer, with a link to the full chat page.

---

## Behaviour

### FAB Button
- Fixed bottom-right, `z-index` above all page content.
- Shows a chat bubble icon (💬).
- Shows a red unread-count badge (number) when `totalUnread > 0`.
- **Hidden** when there are no open rooms (`status === 'open'`).
- **Hidden** on `/chat` and `/chat/[roomId]` paths (use `usePathname()`).
- Clicking while overlay is closed → opens overlay.
- Clicking while overlay is open → closes overlay (toggle).

### Opening the overlay
| Open rooms | Behaviour |
|---|---|
| 0 | FAB hidden — overlay never opens |
| 1 | Popup opens directly into that room |
| 2+ | Popup opens to room list first |

### Popup (compact mode — default)
- Fixed size: `380px` wide × `520px` tall on desktop; full width minus `16px` margin on mobile.
- Anchored above the FAB, bottom-right.
- Closes on ESC or click outside (outside = not the FAB and not the popup itself).
- **Header** (always visible):
  - Left: room title (or "Chats" when showing room list). When in a room from a multi-room list: "← Paris-Nice" (back button + room name).
  - Right: three icon buttons — **⇥** expand to drawer, **↗** go to full page, **✕** close.
- **Body**: room list OR message list + input (see below).

### Side drawer mode (expanded)
- Slides in from the right: `420px` wide, full viewport height. On mobile: full width.
- Semi-transparent dark backdrop (`rgba(0,0,0,0.4)`); clicking backdrop collapses back to popup.
- Header identical to popup, except **⇥** becomes **⇤** (collapse to popup).
- Giphy button visible in input (hidden in popup to save space).

### Room list view (≥2 rooms)
- Each row: room title, `gameType` icon if set, unread badge, last-message timestamp.
- Clicking a row → loads that room's chat.
- Link row at bottom: "Ga naar overzicht →" → navigates to `/chat`.

### Message view (single room selected)
- Reuses `useChatMessages(roomId)` for real-time messages.
- Reuses `ChatMessageItem` for rendering.
- Reuses `ChatInput` with prop `compact={true}` that hides the Giphy button.
- If room `status` changes to `closed` while overlay is open: input is replaced with "Deze chat is gesloten." (read-only, messages still visible).

### Navigate to full page (↗)
- Navigates to `/chat/[roomId]` via `router.push`.
- Overlay closes.
- If user navigates back, overlay starts closed (no state restore).

---

## Unread count

- `useChatRooms` returns `messageCount` per room from Firestore (real-time).
- `localStorage` key per room: `chat_unread_${roomId}` stores the `messageCount` at the last time the user **opened** that room in the overlay or full page.
- **Baseline on first visit / missing key:** default to current `messageCount` → badge starts at 0, only new messages generate a badge.
- **Unread for room:** `max(0, room.messageCount - lastSeen)`.
- **totalUnread:** sum across all open rooms → shown on FAB badge.
- **Reset:** when user selects a room (immediately on click/open), set `localStorage` key to current `messageCount`.

---

## Edge cases

| Situation | Behaviour |
|---|---|
| Room closes while overlay is open | Input replaced with "gesloten" notice; messages remain readable |
| 2nd room opens while overlay shows 1-room view | No mid-session re-render; on next open the room list appears |
| 1 room closes while 2 were open | On next open only 1 remains → opens directly into that room |
| Mobile (< 640px) | Popup: full width minus 16px margin. Drawer: full width |
| FAB clicked while popup open | Closes popup (toggle) |
| Click outside popup | Closes popup (not triggered by clicking FAB itself) |

---

## Architecture

### New files

| File | Purpose |
|---|---|
| `components/chat/ChatFloatingButton.tsx` | FAB + popup + drawer, all state, self-contained client component |
| `hooks/useChatRooms.ts` | Real-time listener on open `chat_rooms` |

### `useChatRooms` interface
```typescript
interface UseChatRoomsResult {
  rooms: ChatRoom[];          // only rooms with status === 'open'
  totalUnread: number;        // sum of per-room unread counts
  loading: boolean;
}
function useChatRooms(): UseChatRoomsResult
```
- Uses `onSnapshot` on `chat_rooms` collection filtered by `status == 'open'`.
- Reads `localStorage` to compute per-room and total unread.
- Requires user to be authenticated (returns `{ rooms: [], totalUnread: 0, loading: true }` until auth resolves).

### Modified files

| File | Change |
|---|---|
| `components/AppShellProviders.tsx` | Add `<ChatFloatingButton />` inside the non-public auth shell (after `<LayoutShell>`) |
| `components/chat/ChatInput.tsx` | Add optional `compact?: boolean` prop that hides the Giphy button |

### State inside `ChatFloatingButton`
```typescript
const [isOpen, setIsOpen] = useState(false);
const [mode, setMode] = useState<'popup' | 'drawer'>('popup');
const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
```

---

## Data flow

```
AppShellProviders
  └── ChatFloatingButton (client, mounted on all authenticated non-public pages)
        ├── useChatRooms()  →  rooms[], totalUnread
        ├── usePathname()   →  hide on /chat/*
        │
        ├── FAB (unread badge, toggle isOpen)
        │
        └── [isOpen]
              ├── mode=popup  → ChatPopup (380×520, bottom-right)
              └── mode=drawer → ChatDrawer (420px, full-height, backdrop)
                    │
                    ├── rooms.length > 1 && selectedRoomId === null
                    │     → RoomList (rows + /chat link)
                    │
                    └── selectedRoomId !== null
                          ├── useChatMessages(selectedRoomId)
                          ├── ChatMessageItem × n
                          └── ChatInput compact={mode==='popup'}
```

---

## Not in scope
- Push notifications.
- Creating new chat rooms from the overlay (admin-only, stays in `/admin/chat`).
- Pagination of room list (assume < 20 open rooms).
- Message pagination in overlay (loads latest 100 via existing hook).
- Persisting overlay open/closed state across page navigation.
