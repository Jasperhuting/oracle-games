'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { ImpersonationContextType } from '@/lib/types/context';

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
      // First, sign out the impersonated user
      const { signOut, signInWithCustomToken } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase/client');
      await signOut(auth);

      const response = await fetch('/api/impersonate/stop', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to stop impersonation');
      }

      const data = await response.json();

      // Get the admin restore token from localStorage or API response
      const adminToken = localStorage.getItem('admin_restore_token') || data.adminToken;

      // Clear impersonation state from localStorage
      localStorage.removeItem('impersonation');
      localStorage.removeItem('impersonation_token');
      localStorage.removeItem('admin_restore_token');
      localStorage.removeItem('restore_admin_session');

      setImpersonatedUser(null);
      setRealAdmin(null);
      setIsImpersonating(false);

      if (adminToken) {
        try {
          // Immediately sign in with the admin token instead of storing it
          console.log('Signing in with admin token immediately...');
          await signInWithCustomToken(auth, adminToken);
          console.log('Successfully signed in as admin');

          // Navigate to admin page after successful sign-in
          window.location.href = '/admin';
        } catch (signInError) {
          console.error('Error signing in with admin token:', signInError);
          // If immediate sign-in fails, fall back to storing the token
          localStorage.setItem('restore_admin_session', adminToken);
          console.log('Stored restore_admin_session token as fallback');
          // Force reload to trigger restore flow
          window.location.href = '/admin';
        }
      } else {
        console.error('No admin token available for restore!');
        // Redirect anyway to force a fresh login
        window.location.href = '/admin';
      }
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      // Clear all impersonation-related data on error
      localStorage.removeItem('impersonation');
      localStorage.removeItem('impersonation_token');
      localStorage.removeItem('admin_restore_token');
      localStorage.removeItem('restore_admin_session');
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
