'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { useAuth } from '@/hooks/useAuth';
import type { User } from '@/lib/types/user';

interface CurrentUserContextType {
  userData: User | null;
  loading: boolean;
  refreshUserData: () => Promise<void>;
  setUserData: Dispatch<SetStateAction<User | null>>;
}

const CurrentUserContext = createContext<CurrentUserContextType | undefined>(undefined);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUserData = useCallback(async () => {
    if (!user) {
      setUserData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/getUser?userId=${user.uid}`);
      if (!response.ok) {
        throw new Error('Failed to load current user');
      }

      const data = await response.json();
      setUserData(data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    void refreshUserData();
  }, [authLoading, refreshUserData]);

  const value = useMemo(
    () => ({
      userData,
      loading,
      refreshUserData,
      setUserData,
    }),
    [loading, refreshUserData, userData]
  );

  return (
    <CurrentUserContext.Provider value={value}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);

  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a CurrentUserProvider');
  }

  return context;
}
