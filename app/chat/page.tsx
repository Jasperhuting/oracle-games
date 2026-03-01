'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { IconMessageCircle, IconLock, IconClock } from '@tabler/icons-react';
import Countdown from 'react-countdown';

interface ChatRoomResponse {
  id: string;
  title: string;
  description: string | null;
  gameType: string | null;
  closesAt: string;
  createdAt: string;
  createdBy: string;
  status: 'open' | 'closed';
  messageCount: number;
}

const GAME_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  football: { bg: 'bg-green-100', text: 'text-green-700' },
  f1: { bg: 'bg-red-100', text: 'text-red-700' },
  cycling: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
};

function getGameTypeBadge(gameType: string | null) {
  if (!gameType) {
    return { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Algemeen' };
  }
  const colors = GAME_TYPE_COLORS[gameType] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  const label = gameType.charAt(0).toUpperCase() + gameType.slice(1);
  return { ...colors, label };
}

function CountdownRenderer({ days, hours, minutes, seconds, completed }: {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  completed: boolean;
}) {
  if (completed) {
    return <span className="text-xs text-gray-500">Gesloten</span>;
  }

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}u`);
  parts.push(`${minutes}m`);
  if (days === 0) parts.push(`${seconds}s`);

  return (
    <span className="text-xs font-medium text-orange-600">
      {parts.join(' ')}
    </span>
  );
}

export default function ChatOverviewPage() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRooms = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/chat/rooms');
        if (!res.ok) {
          setError('Kon chatrooms niet laden.');
          return;
        }
        const data = await res.json();
        setRooms(data.rooms || []);
      } catch {
        setError('Kon chatrooms niet laden.');
      } finally {
        setLoading(false);
      }
    };

    fetchRooms();
  }, [isAuthenticated]);

  if (authLoading) {
    return (
      <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-4xl">
          <div className="text-sm text-gray-500">Laden...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
        <div className="mx-auto container max-w-4xl">
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <IconLock className="mx-auto h-10 w-10 text-gray-400 mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Inloggen vereist</h2>
            <p className="text-sm text-gray-600 mb-4">
              Je moet ingelogd zijn om de chatrooms te bekijken.
            </p>
            <Link
              href="/login"
              className="inline-block px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Inloggen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const openRooms = rooms.filter((r) => r.status === 'open');
  const recentlyClosedRooms = rooms.filter(
    (r) => r.status === 'closed' && new Date(r.closesAt) >= sevenDaysAgo
  );

  return (
    <div className="flex flex-col min-h-screen p-4 sm:p-8 sm:mt-[36px] bg-gray-50">
      <div className="mx-auto container max-w-4xl">
        {/* Back link */}
        <div className="flex flex-row border border-gray-200 mb-6 items-center bg-white px-6 py-4 rounded-lg">
          <Link href="/account" className="text-sm text-gray-600 hover:text-gray-900 underline">
            &larr; Terug naar account
          </Link>
        </div>

        {/* Header */}
        <div className="bg-gradient-to-br from-blue-50 via-white to-indigo-50 border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <IconMessageCircle className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">Chatrooms</h1>
              </div>
              <p className="text-sm text-gray-600">
                Praat mee in de chatrooms over wedstrijden en evenementen.
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="text-sm text-gray-500">Chatrooms laden...</div>
          </div>
        )}

        {error && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="text-sm text-red-600">{error}</div>
          </div>
        )}

        {!loading && !error && openRooms.length === 0 && recentlyClosedRooms.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-6">
            <div className="border border-dashed border-gray-200 rounded-lg p-6 text-center text-gray-400">
              Geen chatrooms gevonden.
            </div>
          </div>
        )}

        {!loading && !error && openRooms.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Open chatrooms
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {openRooms.map((room) => {
                const badge = getGameTypeBadge(room.gameType);
                return (
                  <Link
                    key={room.id}
                    href={`/chat/${room.id}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer block"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {room.title}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 whitespace-nowrap flex-shrink-0">
                        Open
                      </span>
                    </div>

                    {room.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    <div className="flex items-center flex-wrap gap-2 mb-3">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <IconMessageCircle className="h-3.5 w-3.5" />
                        {room.messageCount}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-500">
                      <IconClock className="h-3.5 w-3.5" />
                      <Countdown
                        date={new Date(room.closesAt)}
                        renderer={CountdownRenderer}
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {!loading && !error && recentlyClosedRooms.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Recent gesloten
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recentlyClosedRooms.map((room) => {
                const badge = getGameTypeBadge(room.gameType);
                return (
                  <Link
                    key={room.id}
                    href={`/chat/${room.id}`}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer block opacity-75"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-gray-900 text-sm leading-tight">
                        {room.title}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600 whitespace-nowrap flex-shrink-0">
                        Gesloten
                      </span>
                    </div>

                    {room.description && (
                      <p className="text-xs text-gray-500 mb-3 line-clamp-2">
                        {room.description}
                      </p>
                    )}

                    <div className="flex items-center flex-wrap gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.label}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <IconMessageCircle className="h-3.5 w-3.5" />
                        {room.messageCount}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
