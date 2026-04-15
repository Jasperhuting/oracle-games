'use client';

import { useEffect, useState, useCallback } from 'react';
import { authorizedFetch } from '@/lib/auth/token-service';
import { IconUsers, IconRefresh } from '@tabler/icons-react';
import Image from 'next/image';

interface ActiveUser {
  uid: string;
  playername: string;
  avatarUrl?: string;
}

const REFRESH_INTERVAL_MS = 60 * 1000;

export function ActiveUsersCard() {
  const [users, setUsers] = useState<ActiveUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActiveUsers = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await authorizedFetch('/api/users/active');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchActiveUsers();
    const interval = setInterval(() => void fetchActiveUsers(), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchActiveUsers]);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <IconUsers className="w-5 h-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Nu online</h2>
          {!loading && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
              {users.length}
            </span>
          )}
        </div>
        <button
          onClick={() => void fetchActiveUsers(true)}
          disabled={refreshing || loading}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
          aria-label="Verversen"
        >
          <IconRefresh className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Laden...</div>
      ) : users.length === 0 ? (
        <div className="text-sm text-gray-400">Geen spelers actief op dit moment.</div>
      ) : (
        <ul className="space-y-2">
          {users.map(u => (
            <li key={u.uid} className="flex items-center gap-3">
              <div className="relative">
                {u.avatarUrl ? (
                  <Image
                    src={u.avatarUrl}
                    alt={u.playername}
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium">
                    {u.playername?.[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <span className="text-sm text-gray-800">{u.playername}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-gray-400 mt-4">Actief in de afgelopen 10 minuten</p>
    </div>
  );
}
