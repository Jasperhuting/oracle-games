'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { RaceManagementDashboard } from '@/components/admin/RaceManagementDashboard';
import Link from 'next/link';
import { ArrowRight } from 'tabler-icons-react';

export default function RaceManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!loading && !user) {
        router.push('/login');
        return;
      }

      if (user) {
        try {
          const response = await fetch(`/api/getUser?userId=${user.uid}`);
          if (response.ok) {
            const userData = await response.json();
            if (userData.userType === 'admin') {
              setIsAdmin(true);
            } else {
              router.push('/home');
            }
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
          router.push('/home');
        } finally {
          setChecking(false);
        }
      }
    };

    checkAdminStatus();
  }, [user, loading, router]);

  if (loading || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen p-8 mt-[36px] bg-gray-50">
      <div className="container mx-auto max-w-7xl">
        <div className="flex flex-row border border-gray-200 pb-4 mb-8 items-center bg-white px-6 py-4 rounded-lg">
          <Link href="/home" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Back to Home
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Admin
          </Link>
          <ArrowRight className="mx-2" size={16} />
          <span className="text-sm text-gray-900">Race Management</span>
        </div>

        <div className="bg-white rounded-lg shadow">
          <RaceManagementDashboard />
        </div>
      </div>
    </div>
  );
}
