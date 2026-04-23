'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { GameStandingsView, GameStandingRow } from '@/components/game-dashboard/GameStandingsView';

interface TeamOverview {
  ranking: number;
  playername: string;
  userId: string;
  totalPoints?: number;
  participantId: string;
  eligibleForPrizes?: boolean;
  totalPercentageDiff?: number;
  totalSpent?: number;
  riders?: Array<{ pointsScored?: number; pricePaid?: number }>;
}

export default function StandingsPage() {
  const params = useParams();
  const { user } = useAuth();
  const gameId = params?.gameId as string;

  const [standings, setStandings] = useState<GameStandingRow[]>([]);
  const [gameName, setGameName] = useState<string>('');
  const [gameYear, setGameYear] = useState<number>(new Date().getFullYear());
  const [gameType, setGameType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backHref = gameType === 'full-grid' ? `/games/${gameId}/auction` : '/games';

  useEffect(() => {
    async function fetchStandings() {
      if (!gameId) return;

      setLoading(true);
      setError(null);

      try {
        // Fetch game info for the name
        const gameResponse = await fetch(`/api/games/${gameId}`);

        if (gameResponse.ok) {
          const gameData = await gameResponse.json();
          setGameName(gameData.game?.name || '');
          if (typeof gameData.game?.year === 'number') {
            setGameYear(gameData.game.year);
          }
          setGameType(gameData.game?.gameType ?? gameData.game?.config?.gameType ?? null);
        }

        // Fetch standings
        const response = await fetch(`/api/games/${gameId}/teams-overview`);
        if (!response.ok) {
          throw new Error('Failed to load standings');
        }
        const data = await response.json();
        const teams: TeamOverview[] = data.teams || [];

        const mappedStandings: GameStandingRow[] = teams.map((team) => ({
          ranking: team.ranking,
          playername: team.playername,
          userId: team.userId,
          totalPoints: team.totalPoints ?? 0,
          participantId: team.participantId,
          eligibleForPrizes: team.eligibleForPrizes,
          totalPercentageDiff: team.totalPercentageDiff,
          totalSpent: team.totalSpent,
          riders: team.riders,
        }));

        setStandings(mappedStandings);
      } catch (err) {
        console.error('Error loading standings:', err);
        setError('Kon tussenstand niet laden');
      } finally {
        setLoading(false);
      }
    }

    fetchStandings();
  }, [gameId]);
  return (
    <GameStandingsView
      standings={standings}
      gameId={gameId}
      gameName={gameName}
      gameYear={gameYear}
      gameType={gameType}
      loading={loading}
      error={error}
      backHref={backHref}
      currentUserId={user?.uid}
    />
  );
}
