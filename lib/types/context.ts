/**
 * Context Types
 * Types for React contexts and providers
 */

import { ReactNode } from 'react';
import { User } from 'firebase/auth';
import { Rider } from './rider';
import { PlayerTeam } from './games';

// Rankings Context
export interface RankingsContextType {
  riders: Rider[];
  uniqueRiders: Rider[];
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;
  getRiderById: (id: string) => Rider | undefined;
  getRidersByIds: (ids: string[]) => Rider[];
}
export interface PlayerTeamsContextType {
  riders: PlayerTeam[];
  uniqueRiders: PlayerTeam[];
  loading: boolean;
  error: string | null;
  refetch: (forceRefresh?: boolean) => Promise<void>;  
  total: number;
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
