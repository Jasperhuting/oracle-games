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
  const [raceType, setRaceType] = useState<string | null>(null);
  const [showStageWins, setShowStageWins] = useState(false);
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
        let currentGameType: string | null = null;
        let currentShowStageWins = false;

        if (gameResponse.ok) {
          const gameData = await gameResponse.json();
          setGameName(gameData.game?.name || '');
          if (typeof gameData.game?.year === 'number') {
            setGameYear(gameData.game.year);
          }
          currentGameType = gameData.game?.gameType ?? gameData.game?.config?.gameType ?? null;
          currentShowStageWins = gameData.game?.config?.showStageWins ?? false;
          setGameType(currentGameType);
          setRaceType(gameData.game?.raceType ?? null);
          setShowStageWins(currentShowStageWins);
        }

        const fetchStageWins = currentGameType === 'full-grid' && currentShowStageWins
          ? fetch(`/api/games/${gameId}/stage-wins`).then(r => r.ok ? r.json() : null).catch(() => null)
          : Promise.resolve(null);

        const [response, stageWinsData] = await Promise.all([
          fetch(`/api/games/${gameId}/teams-overview`),
          fetchStageWins,
        ]);
        if (!response.ok) {
          throw new Error('Failed to load standings');
        }
        const data = await response.json();
        const teams: TeamOverview[] = data.teams || [];

        const stageWinsMap = new Map<string, number>();
        if (stageWinsData?.ranking) {
          for (const entry of stageWinsData.ranking) {
            stageWinsMap.set(entry.userId, entry.stageWins);
          }
        }

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
          stageWins: stageWinsMap.get(team.userId) ?? 0,
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
      raceType={raceType}
      loading={loading}
      error={error}
      backHref={backHref}
      currentUserId={user?.uid}
      showStageWins={showStageWins}
    />
  );
}
