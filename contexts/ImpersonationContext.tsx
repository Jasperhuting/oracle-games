'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';

interface ImpersonationContextType {
  impersonatedUser: User | null;
  realAdmin: User | null;
  isImpersonating: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
  const [realAdmin, setRealAdmin] = useState<User | null>(null);
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Load impersonation state from localStorage on mount
  useEffect(() => {
    const storedImpersonation = localStorage.getItem('impersonation');
    if (storedImpersonation) {
      try {
        const { impersonatedUserId, realAdminId } = JSON.parse(storedImpersonation);
        if (impersonatedUserId && realAdminId) {
          // Restore impersonation state
          setIsImpersonating(true);
          // Note: We'll need to fetch the actual user objects
          // This is just to maintain the flag
        }
      } catch (error) {
        console.error('Error loading impersonation state:', error);
        localStorage.removeItem('impersonation');
      }
    }
  }, []);

  const startImpersonation = async (userId: string) => {
    try {
      const response = await fetch('/api/impersonate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to start impersonation');
      }

      const data = await response.json();
      
      // Store the custom token for sign-in
      localStorage.setItem('impersonation_token', data.customToken);
      
      // Store the admin token to restore session later
      localStorage.setItem('admin_restore_token', data.adminToken);
      
      // Store impersonation state
      localStorage.setItem('impersonation', JSON.stringify({
        impersonatedUserId: data.impersonatedUser.uid,
        realAdminId: data.realAdmin.uid,
      }));

      setImpersonatedUser(data.impersonatedUser);
      setRealAdmin(data.realAdmin);
      setIsImpersonating(true);

      // Reload the page to apply impersonation
      window.location.href = '/home';
    } catch (error) {
      console.error('Error starting impersonation:', error);
      throw error;
    }
  };

  const stopImpersonation = async () => {
    try {
      const response = await fetch('/api/impersonate/stop', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Failed to stop impersonation');
      }
      
      const data = await response.json();
      
      // Get the admin restore token from localStorage
      const adminToken = localStorage.getItem('admin_restore_token') || data.adminToken;

      // Clear impersonation state
      localStorage.removeItem('impersonation');
      localStorage.removeItem('impersonation_token');
      localStorage.removeItem('admin_restore_token');
      
      setImpersonatedUser(null);
      setRealAdmin(null);
      setIsImpersonating(false);
      
      if (adminToken) {
        // Store admin token temporarily to restore session
        localStorage.setItem('restore_admin_session', adminToken);
        console.log('Stored restore_admin_session token');
      } else {
        console.error('No admin token available for restore!');
      }
      
      // Small delay to ensure localStorage is written before redirect
      await new Promise(resolve => setTimeout(resolve, 100));

      // Force reload to admin page - this will trigger the restore flow in useAuth
      window.location.href = '/admin';
    } catch (error) {
      console.error('Error stopping impersonation:', error);
    }
  };

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        realAdmin,
        isImpersonating,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
