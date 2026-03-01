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

export interface ChatMessageEdit {
  text: string;
  editedAt: Timestamp | string;
}

export interface ChatMessage {
  id: string;
  text: string;
  giphy?: {
    id: string;
    title: string;
    url: string;
    previewUrl: string;
    width: number | null;
    height: number | null;
  } | null;
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
  editedAt?: Timestamp | string | null;
  editHistory?: ChatMessageEdit[];
  createdAt: Timestamp | string;
}

export interface ChatMutedUser {
  userId: string;
  mutedBy: string;
  mutedUntil: Timestamp | string;
  reason?: string;
}
