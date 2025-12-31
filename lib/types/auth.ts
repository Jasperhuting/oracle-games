/**
 * Authentication Types
 * Types for authentication, user accounts, and security
 */

export interface AccountSettingsProps {
  userId: string;
}

export interface AccountFormData {
  displayName: string;
  email: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export interface PasskeyInfo {
  id: string;
  name: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

export interface PasskeySetupProps {
  userId: string;
  onSuccess: () => void;
}

export interface ImpersonationBannerProps {
  originalUserId: string;
  currentUserId: string;
  onStopImpersonation: () => void;
}
