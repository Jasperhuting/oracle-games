/**
 * Activity Log Types
 * Types for activity logging and tracking
 */

export interface ActivityLog {
  id: string;
  action: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  gameId?: string;
  gameName?: string;
  details?: Record<string, unknown> & {
    environment?: string;
    branch?: string;
    commit?: string;
    commitMessage?: string;
    deploymentId?: string;
    deploymentStatus?: string;
    deploymentUrl?: string;
  };
  timestamp: string; // ISO 8601 string from API
  ipAddress?: string;
  userAgent?: string;
}
