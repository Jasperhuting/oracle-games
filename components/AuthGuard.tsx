'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';

const publicRoutes = ['/login', '/register', '/reset-password'];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      // If user is not authenticated and trying to access protected route
      if (!user && !publicRoutes.includes(pathname)) {
        router.push('/login');
      }
      // If user is authenticated and trying to access auth routes
      else if (user && publicRoutes.includes(pathname)) {
        router.push('/home');
      }
    }
  }, [user, loading, pathname, router]);

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  // Don't render protected content if not authenticated
  if (!user && !publicRoutes.includes(pathname)) {
    return null;
  }

  // Don't render auth pages if already authenticated
  if (user && publicRoutes.includes(pathname)) {
    return null;
  }

  return <>{children}</>;
}
