'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { WkAdminNav } from '@/components/WkAdminNav';
import type { WkCalendarSyncResult } from '@/lib/google-calendar/wkSync';

export default function WkCalendarAdminPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<WkCalendarSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push('/wk-2026/predictions');
      return;
    }

    fetch(`/api/getUser?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.userType !== 'admin') router.push('/wk-2026/predictions');
      })
      .catch(() => router.push('/wk-2026/predictions'));
  }, [user, loading, router]);

  async function handleSync() {
    if (!user) return;
    setSyncing(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/sync-wk-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Onbekende fout');
      } else {
        setResult(data);
      }
    } catch {
      setError('Netwerkfout bij synchronisatie');
    } finally {
      setSyncing(false);
    }
  }

  const statusColor: Record<string, string> = {
    created: 'text-green-700 bg-green-50',
    updated: 'text-blue-700 bg-blue-50',
    unchanged: 'text-gray-500 bg-gray-50',
    failed: 'text-red-700 bg-red-50',
  };

  return (
    <div className="p-8 mt-9 max-w-4xl">
      <WkAdminNav />
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Google Calendar sync</h1>
      <p className="text-sm text-gray-500 mb-6">
        Synchroniseer alle 104 WK 2026 wedstrijden naar de Google Kalender.
      </p>

      <button
        onClick={handleSync}
        disabled={syncing}
        className="px-6 py-3 bg-[#ff9900] text-white font-semibold rounded-lg hover:bg-[#e68a00] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {syncing ? 'Bezig met synchroniseren...' : 'Synchroniseer kalender'}
      </button>

      {error && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          {!result.enabled ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
              Kalender sync niet geconfigureerd: {result.reason}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Aangemaakt', value: result.created, color: 'text-green-700' },
                  { label: 'Bijgewerkt', value: result.updated, color: 'text-blue-700' },
                  { label: 'Ongewijzigd', value: result.unchanged, color: 'text-gray-600' },
                  { label: 'Mislukt', value: result.failed, color: 'text-red-700' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                    <div className={`text-3xl font-bold ${color}`}>{value}</div>
                    <div className="text-xs text-gray-500 mt-1">{label}</div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400">
                Kalender ID: {result.calendarId} &middot; {result.total} wedstrijden totaal
              </p>

              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Wedstrijd</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.results.map((r) => (
                      <tr key={r.matchId}>
                        <td className="px-4 py-2 text-gray-400 tabular-nums">{r.matchNumber}</td>
                        <td className="px-4 py-2 text-gray-700">{r.matchId}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColor[r.status] ?? ''}`}>
                            {r.status}
                            {r.error ? `: ${r.error}` : ''}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
