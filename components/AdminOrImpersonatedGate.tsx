'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AdminOrImpersonatedGateProps {
  children: React.ReactNode;
}

export function AdminOrImpersonatedGate({ children }: AdminOrImpersonatedGateProps) {
  const router = useRouter();
  const { user, loading, impersonationStatus } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user || loading) return;
      try {
        const response = await fetch(`/api/getUser?userId=${user.uid}`);
        if (!response.ok) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setIsAdmin(data.userType === 'admin');
        }
      } catch {
        if (!cancelled) setIsAdmin(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    if (!loading) {
      if (!user) {
        setChecking(false);
        router.push('/login');
        return;
      }
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  const isAllowed = isAdmin || impersonationStatus.isImpersonating;

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8 bg-gray-50">
        <div className="text-gray-600">Laden...</div>
      </div>
    );
  }

  if (!isAllowed) {
    router.push('/account');
    return null;
  }

  return <>{children}</>;
}
