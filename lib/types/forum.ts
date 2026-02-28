export type ForumTopicStatus = 'open' | 'locked';

export interface ForumGameDivision {
  id: string;
  division?: string | null;
  divisionLevel?: number | null;
}

export interface ForumGame {
  id: string;
  name: string;
  status?: string;
  topicCount: number;
  lastActivityAt?: string | null;
  gameIds?: string[];
  divisions?: ForumGameDivision[];
}

export interface ForumCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
}

export interface ForumTopic {
  id: string;
  categoryId?: string;
  categorySlug?: string;
  gameId?: string;
  gameName?: string;
  gameDivision?: string | null;
  gameDivisionLevel?: number | null;
  isMainTopic?: boolean;
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
