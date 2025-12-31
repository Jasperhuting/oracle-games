/**
 * Context Types
 * Types for React contexts and providers
 */

import { ReactNode } from 'react';
import { User } from 'firebase/auth';
import { Rider } from './rider';

// Rankings Context
export interface RankingsContextType {
  riders: Rider[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getRiderById: (id: string) => Rider | undefined;
  getRidersByIds: (ids: string[]) => Rider[];
}

export interface RankingsProviderProps {
  children: ReactNode;
  autoLoad?: boolean; // Whether to automatically load rankings on mount (default: true)
}

// Impersonation Context
export interface ImpersonationContextType {
  impersonatedUser: User | null;
  realAdmin: User | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}
