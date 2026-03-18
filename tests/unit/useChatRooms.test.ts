import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase/client', () => ({ db: {} }));

import { computeUnreadCounts } from '@/hooks/useChatRooms';

// Node 25 ships a localStorage stub without real methods; replace it with a
// simple in-memory implementation so the tests can run in the node environment.
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
};
vi.stubGlobal('localStorage', localStorageMock);

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
