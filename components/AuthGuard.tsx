'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { isPublicRoute, isOpenRoute } from '@/lib/constants/routes';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);
  const isOpen = isOpenRoute(pathname);

  // Check if user is fully authenticated (logged in AND email verified)
  // Google users are always verified, email users need to verify
  const isFullyAuthenticated = user && user.emailVerified;

  useEffect(() => {
    if (!loading) {
      // Open routes (e.g. /preview) are accessible to everyone — no redirect
      if (isOpen) return;

      // If user is not fully authenticated and trying to access protected route
      if (!isFullyAuthenticated && !isPublic) {
        // If user exists but email not verified, redirect to verify-email
        if (user && !user.emailVerified) {
          router.push('/verify-email');
        } else {
          router.push('/login');
        }
      }
      // If user is fully authenticated and trying to access auth routes (except verify-email with unverified user)
      else if (isFullyAuthenticated && isPublic) {
        router.push('/home');
      }
    }
  }, [user, loading, isPublic, isOpen, router, isFullyAuthenticated]);

  // Open and public routes should render immediately, even when auth check is still in-flight.
  if (isOpen || isPublic) {
    return <>{children}</>;
  }

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render protected content if not fully authenticated
  if (!isFullyAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
