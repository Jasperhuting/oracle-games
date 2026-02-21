'use client'

import { useEffect, useMemo, useState } from 'react';
import { X } from 'tabler-icons-react';

type ScoreUpdate = {
  id: string;
  year: number;
  raceSlug: string;
  stage: string;
  calculatedAt: string;
  totalPointsAwarded: number;
  gamesAffected: string[];
};

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie.split('; ');
  const cookie = cookies.find((c) => c.startsWith(`${name}=`));
  return cookie ? cookie.split('=')[1] : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

function formatStageLabel(stage: string) {
  if (stage === 'result') return 'Result';
  if (stage === 'tour-gc') return 'GC';
  if (stage === 'prologue') return 'Prologue';

  const asNumber = Number(stage);
  if (!Number.isNaN(asNumber) && asNumber > 0) return `Etappe ${asNumber}`;

  return stage;
}

function formatRaceLabel(raceSlug: string) {
  return raceSlug
    .replace(/-+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function ScoreUpdateBanner({
  year,
  gameId,
  raceSlug,
}: {
  year: number;
  gameId?: string;
  raceSlug?: string;
}) {
  const [update, setUpdate] = useState<ScoreUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(null);

  const dismissedIdCookieName = 'dismissed-score-update-id';

  useEffect(() => {
    setDismissedUpdateId(getCookieValue(dismissedIdCookieName));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (gameId) params.set('gameId', gameId);
        if (raceSlug) params.set('raceSlug', raceSlug);

        const res = await fetch(`/api/score-updates?${params.toString()}`);
        if (!res.ok) {
          setUpdate(null);
          return;
        }

        const data = await res.json();
        if (cancelled) return;
        setUpdate(data.update || null);
      } catch {
        if (cancelled) return;
        setUpdate(null);
      } finally {
        if (cancelled) return;
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [year, gameId, raceSlug]);

  const shouldShow = useMemo(() => {
    if (loading) return false;
    if (!update) return false;
    if (dismissedUpdateId && dismissedUpdateId === update.id) return false;
    return true;
  }, [loading, update, dismissedUpdateId]);

  const message = useMemo(() => {
    if (!update) return '';

    const dateStr = update.calculatedAt
      ? new Date(update.calculatedAt).toLocaleString('nl-NL', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    return `Scores bijgewerkt: ${formatRaceLabel(update.raceSlug)} – ${formatStageLabel(update.stage)} (${dateStr})`;
  }, [update]);

  const dismiss = () => {
    if (!update) return;

    const maxAge = 60 * 60 * 24 * 30;
    setCookie(dismissedIdCookieName, update.id, maxAge);
    setDismissedUpdateId(update.id);
  };

  if (!shouldShow) return null;

  return (
    <div className="mb-4 rounded-lg bg-primary text-white px-4 py-2 flex items-center justify-between gap-4">
      <div className="text-sm">{message}</div>
      <button
        className="h-8 w-8 flex items-center justify-center cursor-pointer"
        onClick={dismiss}
        aria-label="Dismiss"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
