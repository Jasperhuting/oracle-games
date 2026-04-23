'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { JoinableGamesTab } from "@/components/JoinableGamesTab";
import { GamesBreadcrumb } from "@/components/GamesBreadcrumb";

export default function GamesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!loading && !user) {
        router.push('/login');
        return;
      }

      if (user) {
        try {
          const res = await fetch(`/api/getUser?userId=${user.uid}`);
          if (res.ok) {
            const data = await res.json();
            if (data.userType === 'admin') {
              setIsAdmin(true);
            } else {
              router.push('/home');
            }
          } else {
            router.push('/home');
          }
        } catch {
          router.push('/home');
        } finally {
          setChecking(false);
        }
      }
    };

    checkAdmin();
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
    <div>
      <div className="relative z-10 flex flex-col min-h-screen px-6 py-8 mt-9">
        <div className="mx-auto container">
          <GamesBreadcrumb />
          <div className="mt-4 mb-6 flex flex-col gap-3">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-700/80">Oracle Games</p>
            <h1 className="text-3xl sm:text-4xl font-semibold font-serif text-gray-900">
              Games overzicht
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl">
              Kies je game, check deadlines en duik meteen in de competitie.
            </p>
          </div>
          <JoinableGamesTab />
        </div>
      </div>
    </div>
  );
}
