/**
 * Messaging Types
 * Types for user messaging, notifications, and inbox
 */

export type TabType = 'inbox' | 'outbox' | 'compose';

export interface User {
  uid: string;
  email: string;
  displayName?: string;
}

export interface UserOption {
  value: string;
  label: string;
  email: string;
}

export interface GameOption {
  value: string;
  label: string;
}

export interface EmailUserModalProps {
  isOpen: boolean;
  userId: string;
  userEmail: string;
  userName?: string;
  onClose: () => void;
}
