'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Tabs } from '@/components/Tabs';
import { MyTeamTab } from '@/components/game-dashboard/MyTeamTab';
import { StandingsTab } from '@/components/game-dashboard/StandingsTab';
import { AllTeamsTab } from '@/components/game-dashboard/AllTeamsTab';
import { ScoreUpdateBanner } from '@/components/ScoreUpdateBanner';
import { Game, GameParticipant } from '@/lib/types/games';

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
  totalPoints: number;
  participantId: string;
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

        // Load team with race points
        const teamResponse = await fetch(`/api/games/${gameId}/team?userId=${user!.uid}`);
        if (!teamResponse.ok) {
          throw new Error('Kon team niet laden');
        }
        const teamData = await teamResponse.json();

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

  // Load Standings data
  useEffect(() => {
    if (!gameId) return;

    async function loadStandings() {
      try {
        setStandingsLoading(true);

        const response = await fetch(`/api/games/${gameId}/teams-overview`);
        if (!response.ok) {
          throw new Error('Kon tussenstand niet laden');
        }
        const data = await response.json();
        const teams = data.teams || [];

        const mappedStandings: Standing[] = teams.map((team: any) => ({
          ranking: team.ranking,
          playername: team.playername,
          totalPoints: team.totalPoints ?? 0,
          participantId: team.participantId,
          totalPercentageDiff: team.totalPercentageDiff,
          totalSpent: team.totalSpent,
          riders: team.riders,
        }));

        setStandings(mappedStandings);
        setStandingsError(null);
      } catch (err) {
        console.error('Error loading standings:', err);
        setStandingsError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      } finally {
        setStandingsLoading(false);
      }
    }

    loadStandings();
  }, [gameId]);

  // Load All Teams data
  useEffect(() => {
    if (!user || !gameId) return;

    async function loadAllTeams() {
      try {
        setAllTeamsLoading(true);

        const teamsResponse = await fetch(`/api/games/${gameId}/teams-overview`);
        if (!teamsResponse.ok) {
          throw new Error('Kon teams niet laden');
        }

        const data = await teamsResponse.json();
        setAllTeams(data.teams || []);
        setAllTeamsError(null);
      } catch (err) {
        console.error('Error loading all teams:', err);
        setAllTeamsError(err instanceof Error ? err.message : 'Er is een fout opgetreden');
      } finally {
        setAllTeamsLoading(false);
      }
    }

    loadAllTeams();
  }, [user, gameId]);

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
          gameId={gameId}
          standings={standings}
          gameType={game?.gameType ?? null}
          loading={standingsLoading}
          error={standingsError}
        />
      ),
    },
    {
      id: 'alle-teams',
      label: 'Alle Teams',
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
                Bekijk je team, de stand en alle teams
              </p>
            </div>
            <div className="flex gap-2">
              {(game?.gameType === 'auctioneer' || game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains') && (
                <Link
                  href={`/games/${gameId}/auction`}
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
                >
                  {game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains' ? 'Selectie' : 'Auction'}
                </Link>
              )}
              <Link
                href="/games"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Terug naar Games
              </Link>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs tabs={tabs} defaultTab="mijn-team" />
      </div>
    </div>
  );
}
