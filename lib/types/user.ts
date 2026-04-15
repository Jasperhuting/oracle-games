/**
 * User Types
 * Types for user data, profiles, and management
 */

import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  preferredLanguage?: 'en' | 'nl';
  emailNotifications?: boolean;
  forumNotifications?: {
    replyOnMyTopic: boolean;
    dailyDigest: boolean;
  };
  avatarUrl?: string;
  showOnlineStatus?: boolean;
  userType: string;
  authMethod?: string;
  lastLoginMethod?: string;
  lastLoginAt?: Timestamp;
  lastActiveAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: string;
  blocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}
