'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Tabs } from '@/components/Tabs';
import { MyTeamTab } from '@/components/game-dashboard/MyTeamTab';
import { StandingsTab } from '@/components/game-dashboard/StandingsTab';
import { AllTeamsTab } from '@/components/game-dashboard/AllTeamsTab';
import { SimpleAllTeamsTab } from '@/components/game-dashboard/SimpleAllTeamsTab';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';
import { Game, GameParticipant } from '@/lib/types/games';
import { fetchTeamsOverviewWithCache } from '@/lib/utils/teamsOverviewCache';
import { fetchTeamWithCache } from '@/lib/utils/teamCache';

interface TeamRider {
  id: string;
  nameId: string;
  name: string;
  team: string;
  country: string;
  rank: number;
  points: number;
  jerseyImage?: string;
  pricePaid?: number;
  baseValue?: number;
  acquisitionType?: string;
  acquiredAt?: string;
  racePoints?: Record<string, {
    totalPoints: number;
    stagePoints: Record<string, {
      stageResult?: number;
      gcPoints?: number;
      pointsClass?: number;
      mountainsClass?: number;
      youthClass?: number;
      mountainPoints?: number;
      sprintPoints?: number;
      combativityBonus?: number;
      teamPoints?: number;
      total: number;
    }>;
  }>;
}

interface Standing {
  ranking: number;
  playername: string;
  userId: string;
  totalPoints: number;
  participantId: string;
  eligibleForPrizes?: boolean;
  totalPercentageDiff?: number;
  totalSpent?: number;
  riders?: Array<{ pointsScored?: number; pricePaid?: number }>;
}

interface AllTeamsRider {
  riderId: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  riderCountry: string;
  baseValue: number;
  pricePaid: number;
  pointsScored: number;
  percentageDiff: number;
  bidAt?: string;
  acquiredAt?: string;
}

interface AllTeamsTeam {
  participantId: string;
  playername: string;
  userId: string;
  ranking: number;
  eligibleForPrizes?: boolean;
  totalRiders: number;
  totalBaseValue: number;
  totalSpent: number;
  totalPoints: number;
  totalPercentageDiff: number;
  riders: AllTeamsRider[];
}

export default function GameDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const gameId = params?.gameId as string;

  // Shared state
  const [game, setGame] = useState<Game | null>(null);
  const [gameYear, setGameYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // My Team tab state
  const [participant, setParticipant] = useState<GameParticipant | null>(null);
  const [myRiders, setMyRiders] = useState<TeamRider[]>([]);
  const [myTeamLoading, setMyTeamLoading] = useState(true);
  const [myTeamError, setMyTeamError] = useState<string | null>(null);

  // Standings tab state
  const [standings, setStandings] = useState<Standing[]>([]);
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState<string | null>(null);

  // All Teams tab state
  const [allTeams, setAllTeams] = useState<AllTeamsTeam[]>([]);
  const [allTeamsLoading, setAllTeamsLoading] = useState(true);
  const [allTeamsError, setAllTeamsError] = useState<string | null>(null);

  const riderSelectionStats = useMemo(() => {
    const totalTeams = allTeams.length;
    if (totalTeams === 0) return {};

    const riderCounts = new Map<string, number>();
    allTeams.forEach((team) => {
      team.riders.forEach((rider) => {
        const riderKey = rider.riderNameId || rider.riderId;
        riderCounts.set(riderKey, (riderCounts.get(riderKey) || 0) + 1);
      });
    });

    const stats: Record<string, { selectedBy: number; totalTeams: number; percentage: number }> = {};
    riderCounts.forEach((selectedBy, riderKey) => {
      stats[riderKey] = {
        selectedBy,
        totalTeams,
        percentage: Math.round((selectedBy / totalTeams) * 100),
      };
    });

    return stats;
  }, [allTeams]);

  const myStandingRanking = useMemo(() => {
    if (!participant) return undefined;
    const standing = standings.find((entry) => entry.participantId === participant.id);
    return standing?.ranking ?? participant.ranking;
  }, [participant, standings]);

  // Load game data
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!gameId) return;

    async function loadGameData() {
      try {
        setLoading(true);

        // Load game details
        const gameResponse = await fetch(`/api/games/${gameId}`);
        if (!gameResponse.ok) {
          throw new Error('Kon game niet laden');
        }
        const gameData = await gameResponse.json();
        setGame(gameData.game);
        if (typeof gameData.game?.year === 'number') {
          setGameYear(gameData.game.year);
        }

        setError(null);
      } catch (err) {
        console.error('Error loading game:', err);
        setError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      } finally {
        setLoading(false);
      }
    }

    loadGameData();
  }, [user, authLoading, gameId, router]);

  // Load My Team data
  useEffect(() => {
    if (!user || !gameId || authLoading) return;

    async function loadMyTeam() {
      try {
        setMyTeamLoading(true);

        // Load participant data
        const participantResponse = await fetch(`/api/gameParticipants?userId=${user!.uid}&gameId=${gameId}`);
        if (!participantResponse.ok) {
          throw new Error('Kon deelname niet laden');
        }
        const participantData = await participantResponse.json();

        if (participantData.participants.length === 0) {
          throw new Error('Je doet niet mee aan deze game');
        }
        setParticipant(participantData.participants[0]);

        // Load team with race points (IndexedDB cached).
        const { data: teamData } = await fetchTeamWithCache(gameId, user!.uid, {
          maxAgeMs: 2 * 60 * 1000,
        });

        // Sort riders by points (highest first)
        const sortedRiders = (teamData.riders || []).sort((a: TeamRider, b: TeamRider) => b.points - a.points);
        setMyRiders(sortedRiders);

        setMyTeamError(null);
      } catch (err) {
        console.error('Error loading my team:', err);
        setMyTeamError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      } finally {
        setMyTeamLoading(false);
      }
    }

    loadMyTeam();
  }, [user, authLoading, gameId]);

  // Load teams-overview once, then derive both standings and all teams from it.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    async function loadOverview() {
      try {
        setStandingsLoading(true);
        setAllTeamsLoading(true);

        const { data } = await fetchTeamsOverviewWithCache(gameId, {
          maxAgeMs: 2 * 60 * 1000,
        });
        if (cancelled) return;

        const teams: AllTeamsTeam[] = (data.teams || []) as AllTeamsTeam[];
        const mappedStandings: Standing[] = teams.map((team) => ({
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

        setAllTeams(teams);
        setStandings(mappedStandings);
        setAllTeamsError(null);
        setStandingsError(null);
      } catch (err) {
        console.error('Error loading teams-overview:', err);
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Er is een fout opgetreden';
        setAllTeamsError(message);
        setStandingsError(message);
      } finally {
        if (cancelled) return;
        setStandingsLoading(false);
        setAllTeamsLoading(false);
      }
    }

    loadOverview();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <Link
            href="/games"
            className="text-blue-600 hover:text-blue-700"
          >
            Terug naar games
          </Link>
        </div>
      </div>
    );
  }

  const tabs = [
    {
      id: 'mijn-team',
      label: 'Mijn Team',
      content: (
        <MyTeamTab
          game={game}
          participant={participant}
          riders={myRiders}
          displayRanking={myStandingRanking}
          riderSelectionStats={riderSelectionStats}
          loading={myTeamLoading}
          error={myTeamError}
        />
      ),
    },
    {
      id: 'klassement',
      label: 'Klassement',
      content: (
        <StandingsTab
          standings={standings}
          gameType={game?.gameType ?? null}
          loading={standingsLoading}
          error={standingsError}
          currentUserId={user?.uid}
        />
      ),
    },
    {
      id: 'alle-teams',
      label: 'Alle Teams',
      content: (
        <SimpleAllTeamsTab
          teams={allTeams}
          currentUserId={user?.uid}
          loading={allTeamsLoading}
          error={allTeamsError}
        />
      ),
    },
    {
      id: 'statistiek',
      label: 'Statistiek',
      content: (
        <AllTeamsTab
          game={game}
          teams={allTeams}
          currentUserId={user?.uid}
          loading={allTeamsLoading}
          error={allTeamsError}
        />
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ScoreUpdateBanner year={gameYear} gameId={gameId} />

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                {game?.name || 'Game Dashboard'}
              </h1>
              <p className="text-gray-600">
                Bekijk je team, het klassement, alle teams en statistieken
              </p>
            </div>
            <div className="flex gap-2">
              {game?.gameType === 'auctioneer' && (
                <Link
                  href={`/games/${gameId}/auction`}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                >
                  Auction
                </Link>
              )}
              {game?.gameType !== 'worldtour-manager' && game?.gameType !== 'marginal-gains' && (
                <Link
                  href="/games"
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Terug naar Games
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="mijn-team" />
      </div>
    </div>
  );
}
