/**
 * Hook Types
 * Types for custom React hooks
 */

// useAuth hook
export interface ImpersonationStatus {
  isImpersonating: boolean;
  realAdmin?: {
    uid: string;
    email: string | null;
    displayName: string | null;
  };
  impersonatedUser?: {
    uid: string;
    email: string | null;
    displayName: string | null;
  };
  startedAt?: string;
}

// useJobProgress hook
export interface JobProgress {
  id: string;
  type: 'scraper' | 'team-update' | 'bulk-scrape';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    percentage: number;
    stage?: string;
  };
  data?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UseJobProgressOptions {
  pollInterval?: number; // default: 2000ms
  onProgress?: (progress: JobProgress) => void;
  onComplete?: (result: JobProgress) => void;
  onError?: (error: JobProgress) => void;
  enabled?: boolean;
}
