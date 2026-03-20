import { Timestamp } from "firebase/firestore";

export const WK_2026_SEASON = 2026;

export const WK2026_COLLECTIONS = {
  PARTICIPANTS: "participants",
  SUB_LEAGUES: "subLeagues",
} as const;

export interface Wk2026Participant {
  id?: string;
  userId: string;
  season: number;
  displayName: string;
  joinedAt: Timestamp;
  status: "active" | "inactive";
}

export interface Wk2026SubLeague {
  id?: string;
  name: string;
  code: string;
  description?: string;
  season: number;
  createdBy: string;
  memberIds: string[];
  pendingMemberIds: string[];
  isPublic: boolean;
  maxMembers: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export function createWkParticipantDocId(userId: string, season: number = WK_2026_SEASON) {
  return `${userId}_${season}`;
}
