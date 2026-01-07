'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const publicRoutes = ['/login', '/register', '/reset-password', '/verify-email'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Check if user is fully authenticated (logged in AND email verified)
  // Google users are always verified, email users need to verify
  const isFullyAuthenticated = user && user.emailVerified;

  useEffect(() => {
    if (!loading) {
      // If user is not fully authenticated and trying to access protected route
      if (!isFullyAuthenticated && !publicRoutes.includes(pathname)) {
        // If user exists but email not verified, redirect to verify-email
        if (user && !user.emailVerified) {
          router.push('/verify-email');
        } else {
          router.push('/login');
        }
      }
      // If user is fully authenticated and trying to access auth routes (except verify-email with unverified user)
      else if (isFullyAuthenticated && publicRoutes.includes(pathname)) {
        router.push('/home');
      }
    }
  }, [user, loading, pathname, router, isFullyAuthenticated]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render protected content if not fully authenticated
  if (!isFullyAuthenticated && !publicRoutes.includes(pathname)) {
    return null;
  }

  // Don't render auth pages if fully authenticated
  if (isFullyAuthenticated && publicRoutes.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
