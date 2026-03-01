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
