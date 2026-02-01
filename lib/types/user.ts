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
  avatarUrl?: string;
  userType: string;
  authMethod?: string;
  lastLoginMethod?: string;
  lastLoginAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt?: string;
  blocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}
