export type ForumTopicStatus = 'open' | 'locked';

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
}

export interface ForumTopic {
  id: string;
  categoryId: string;
  categorySlug: string;
  gameId?: string;
  createdByName?: string;
  createdByAvatarUrl?: string | null;
  lastReplyUserId?: string | null;
  lastReplyUserName?: string | null;
  lastReplyUserAvatarUrl?: string | null;
  title: string;
  body: string;
  lastReplyPreview?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
  replyCount: number;
  lastReplyAt?: string | null;
  pinned?: boolean;
  status: ForumTopicStatus;
  deleted?: boolean;
}

export interface ForumReply {
  id: string;
  topicId: string;
  parentReplyId?: string | null;
  createdByName?: string;
  createdByAvatarUrl?: string | null;
  body: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string | null;
  deleted?: boolean;
}
