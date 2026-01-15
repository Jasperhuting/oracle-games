import { useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithCustomToken, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';
import { ImpersonationStatus } from '@/lib/types/hooks';

// Global state to share impersonation status across all useAuth instances
let globalImpersonationStatus: ImpersonationStatus = { isImpersonating: false };
const globalImpersonationListeners: Set<(status: ImpersonationStatus) => void> = new Set();
let isCheckingImpersonation = false;
let hasCheckedGlobally = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonationStatus, setImpersonationStatus] = useState<ImpersonationStatus>(globalImpersonationStatus);
  const [restoringSession, setRestoringSession] = useState(false);

  // Function to update global impersonation status
  const updateGlobalImpersonationStatus = (status: ImpersonationStatus) => {
    globalImpersonationStatus = status;
    globalImpersonationListeners.forEach(listener => listener(status));
  };

  // Function to refresh impersonation status
  const refreshImpersonationStatus = async () => {
    if (isCheckingImpersonation) {
      console.log('Already checking impersonation, skipping...');
      return;
    }
    
    isCheckingImpersonation = true;
    try {
      const response = await fetch('/api/impersonate/status');
      if (response.ok) {
        const data = await response.json();
        updateGlobalImpersonationStatus(data);
      }
    } catch (error) {
      console.error('Error refreshing impersonation status:', error);
    } finally {
      isCheckingImpersonation = false;
    }
  };

  // Subscribe to global impersonation status changes
  useEffect(() => {
    const listener = (status: ImpersonationStatus) => {
      setImpersonationStatus(status);
    };
    
    globalImpersonationListeners.add(listener);
    
    return () => {
      globalImpersonationListeners.delete(listener);
    };
  }, []);

  // Check impersonation status on mount (only once globally)
  useEffect(() => {
    if (hasCheckedGlobally) {
      return;
    }
    hasCheckedGlobally = true;
    
    const checkImpersonation = async () => {
      try {
        // Check if we need to restore admin session after stopping impersonation
        const restoreAdminToken = localStorage.getItem('restore_admin_session');
        if (restoreAdminToken) {
          console.log('Restoring admin session...');
          setRestoringSession(true);
          setLoading(true);

          try {
            // First sign out the impersonated user
            await signOut(auth);
            console.log('Signed out impersonated user');

            // Then sign in with the admin token
            await signInWithCustomToken(auth, restoreAdminToken);
            console.log('Signed in with admin token');

            // After restoring admin session, update impersonation status
            const statusResponse = await fetch('/api/impersonate/status');
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              console.log('Admin session restored, impersonation status:', statusData);
              updateGlobalImpersonationStatus(statusData);
            }
          } catch (restoreError) {
            console.error('Error restoring admin session:', restoreError);
            // Clear invalid token to prevent infinite retry loop
          } finally {
            // Always remove the token, whether successful or not
            localStorage.removeItem('restore_admin_session');
            setRestoringSession(false);
            setLoading(false);
          }

          return;
        }

        // Only check if not already checking
        if (!isCheckingImpersonation) {
          await refreshImpersonationStatus();

          // If impersonating and we have a custom token in localStorage, sign in
          if (globalImpersonationStatus.isImpersonating) {
            const customToken = localStorage.getItem('impersonation_token');
            if (customToken) {
              try {
                await signInWithCustomToken(auth, customToken);
              } catch (impersonationError) {
                console.error('Error signing in with impersonation token:', impersonationError);
              } finally {
                // Always remove the token after attempting to use it
                localStorage.removeItem('impersonation_token');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking impersonation status:', error);
        // Ensure we're not stuck in a loading state
        setRestoringSession(false);
        setLoading(false);
      }
    };

    checkImpersonation();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      // Only set loading to false if we're not restoring a session
      if (!restoringSession) {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [restoringSession]);

  return { 
    user, 
    loading: loading || restoringSession, 
    isAuthenticated: !!user,
    impersonationStatus,
    refreshImpersonationStatus,
    restoringSession,
  };
}
