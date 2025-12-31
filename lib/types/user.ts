/**
 * User Types
 * Types for user data, profiles, and management
 */

export interface User {
  uid: string;
  email: string;
  playername: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  userType: string;
  authMethod?: string;
  lastLoginMethod?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt?: string;
  blocked?: boolean;
  blockedAt?: string;
  blockedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}
