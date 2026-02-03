'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { FullGridTeamSelector } from '@/components/full-grid/FullGridTeamSelector';
import { FullGridRiderList } from '@/components/full-grid/FullGridRiderList';
import { FullGridMyTeam } from '@/components/full-grid/FullGridMyTeam';

interface RiderData {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  teamSlug: string;
  jerseyImage?: string;
  value: number;
  country?: string;
}

interface MyTeamRider {
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  jerseyImage?: string;
  value: number;
}

interface GameConfig {
  budget: number;
  maxRiders: number;
  selectionStatus: 'open' | 'closed';
}

export default function FullGridPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const gameId = params?.gameId as string;

  const [gameName, setGameName] = useState<string>('');
  const [gameConfig, setGameConfig] = useState<GameConfig>({ budget: 70, maxRiders: 22, selectionStatus: 'open' });
  const [riders, setRiders] = useState<RiderData[]>([]);
  const [myTeam, setMyTeam] = useState<MyTeamRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);

  // Get unique teams with counts
  const teams = useMemo(() => {
    const teamMap = new Map<string, { name: string; slug: string; jerseyImage?: string; riderCount: number }>();

    riders.forEach(rider => {
      if (!rider.riderTeam) return;
      if (!teamMap.has(rider.riderTeam)) {
        teamMap.set(rider.riderTeam, {
          name: rider.riderTeam,
          slug: rider.teamSlug,
          jerseyImage: rider.jerseyImage,
          riderCount: 0,
        });
      }
      teamMap.get(rider.riderTeam)!.riderCount++;
    });

    return Array.from(teamMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [riders]);

  // Get teams that already have a selected rider
  const teamsWithSelection = useMemo(() => {
    return new Set(myTeam.map(r => r.riderTeam));
  }, [myTeam]);

  // Get riders for selected team
  const teamRiders = useMemo(() => {
    if (!selectedTeam) return [];
    return riders.filter(r => r.riderTeam === selectedTeam).sort((a, b) => b.value - a.value);
  }, [riders, selectedTeam]);

  // Calculate budget stats
  const budgetStats = useMemo(() => {
    const spent = myTeam.reduce((sum, r) => sum + r.value, 0);
    return {
      total: gameConfig.budget,
      spent,
      remaining: gameConfig.budget - spent,
      riderCount: myTeam.length,
      maxRiders: gameConfig.maxRiders,
    };
  }, [myTeam, gameConfig]);

  // Check if rider is in my team
  const isRiderSelected = useCallback((riderNameId: string) => {
    return myTeam.some(r => r.riderNameId === riderNameId);
  }, [myTeam]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!gameId || !user) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch game info and rider values in parallel
      const [gameRes, valuesRes, participantRes] = await Promise.all([
        fetch(`/api/games/${gameId}`),
        fetch(`/api/games/${gameId}/full-grid/rider-values`),
        fetch(`/api/gameParticipants?gameId=${gameId}&userId=${user.uid}`),
      ]);

      if (gameRes.ok) {
        const gameData = await gameRes.json();
        setGameName(gameData.game?.name || '');

        if (gameData.game?.gameType !== 'full-grid') {
          setError('Dit is geen Full Grid spel');
          return;
        }
      }

      if (valuesRes.ok) {
        const valuesData = await valuesRes.json();
        setRiders(valuesData.riders || []);
        setGameConfig({
          budget: valuesData.config?.budget || 70,
          maxRiders: valuesData.config?.maxRiders || 22,
          selectionStatus: valuesData.config?.selectionStatus || 'open',
        });
      }

      if (participantRes.ok) {
        const participantData = await participantRes.json();
        const participant = participantData.participants?.[0];

        if (participant) {
          setIsParticipant(true);

          // Fetch current bids/selections
          const bidsRes = await fetch(`/api/games/${gameId}/bids/list?userId=${user.uid}&limit=100`);
          if (bidsRes.ok) {
            const bidsData = await bidsRes.json();
            const activeBids = (bidsData.bids || []).filter(
              (b: { status: string }) => b.status === 'active' || b.status === 'won'
            );

            // Map bids to team riders
            const team: MyTeamRider[] = activeBids.map((bid: {
              riderNameId: string;
              riderName: string;
              riderTeam: string;
              jerseyImage?: string;
              amount: number;
            }) => ({
              riderNameId: bid.riderNameId,
              riderName: bid.riderName,
              riderTeam: bid.riderTeam,
              jerseyImage: bid.jerseyImage,
              value: bid.amount,
            }));

            setMyTeam(team);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Er ging iets mis bij het laden');
    } finally {
      setLoading(false);
    }
  }, [gameId, user]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // Select a rider
  const selectRider = async (rider: RiderData) => {
    if (!user || !gameId) return;

    // Validation
    if (gameConfig.selectionStatus === 'closed') {
      setError('De selectie is gesloten');
      return;
    }

    if (budgetStats.remaining < rider.value) {
      setError(`Niet genoeg budget. Je hebt nog ${budgetStats.remaining} punten over.`);
      return;
    }

    if (budgetStats.riderCount >= budgetStats.maxRiders) {
      setError(`Je hebt al ${budgetStats.maxRiders} renners geselecteerd.`);
      return;
    }

    if (teamsWithSelection.has(rider.riderTeam)) {
      setError(`Je hebt al een renner van ${rider.riderTeam} geselecteerd.`);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(`/api/games/${gameId}/bids/place`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          riderNameId: rider.riderNameId,
          riderName: rider.riderName,
          riderTeam: rider.riderTeam,
          jerseyImage: rider.jerseyImage,
          amount: rider.value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Selectie mislukt');
      }

      // Add to local team
      setMyTeam(prev => [...prev, {
        riderNameId: rider.riderNameId,
        riderName: rider.riderName,
        riderTeam: rider.riderTeam,
        jerseyImage: rider.jerseyImage,
        value: rider.value,
      }]);

      setSuccessMessage(`${rider.riderName} toegevoegd aan je team!`);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Selectie mislukt');
    } finally {
      setSaving(false);
    }
  };

  // Remove a rider
  const removeRider = async (riderNameId: string) => {
    if (!user || !gameId) return;

    if (gameConfig.selectionStatus === 'closed') {
      setError('De selectie is gesloten');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${gameId}/bids/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          riderNameId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verwijderen mislukt');
      }

      // Remove from local team
      setMyTeam(prev => prev.filter(r => r.riderNameId !== riderNameId));

      setSuccessMessage('Renner verwijderd uit je team');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verwijderen mislukt');
    } finally {
      setSaving(false);
    }
  };

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) {
      // Find first team without a selection
      const unselectedTeam = teams.find(t => !teamsWithSelection.has(t.name));
      setSelectedTeam(unselectedTeam?.name || teams[0].name);
    }
  }, [selectedTeam, teams, teamsWithSelection]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span>Laden...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Je moet ingelogd zijn om deel te nemen.</p>
          <Link href="/login" className="text-primary hover:underline">
            Inloggen
          </Link>
        </div>
      </div>
    );
  }

  if (!isParticipant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Full Grid</h1>
          <p className="text-gray-600 mb-4">
            Je bent nog niet aangemeld voor dit spel.
          </p>
          <Link
            href={`/games/${gameId}/join`}
            className="inline-block px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
          >
            Aanmelden
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Link href={`/games/${gameId}`} className="text-sm text-gray-500 hover:text-gray-700">
                &larr; Terug naar spel
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">{gameName || 'Full Grid'}</h1>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-500">Budget</div>
              <div className="text-xl font-bold">
                <span className={budgetStats.remaining < 0 ? 'text-red-600' : 'text-green-600'}>
                  {budgetStats.remaining}
                </span>
                <span className="text-gray-400"> / {budgetStats.total}</span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
              <span>{budgetStats.riderCount} van {budgetStats.maxRiders} renners</span>
              <span>{Math.round((budgetStats.riderCount / budgetStats.maxRiders) * 100)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(budgetStats.riderCount / budgetStats.maxRiders) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <span className="text-red-700 text-sm">{error}</span>
            <button onClick={() => setError(null)} className="float-right text-red-700">&times;</button>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-green-50 border border-green-200 rounded-md p-3">
            <span className="text-green-700 text-sm">{successMessage}</span>
          </div>
        </div>
      )}

      {gameConfig.selectionStatus === 'closed' && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
            <span className="text-yellow-700 text-sm">De selectie is gesloten. Je kunt geen wijzigingen meer maken.</span>
          </div>
        </div>
      )}

      {/* Main content - three columns */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left column - Team selector */}
          <div className="lg:col-span-3">
            <FullGridTeamSelector
              teams={teams}
              selectedTeam={selectedTeam}
              teamsWithSelection={teamsWithSelection}
              onSelectTeam={setSelectedTeam}
            />
          </div>

          {/* Middle column - Rider list */}
          <div className="lg:col-span-5">
            <FullGridRiderList
              riders={teamRiders}
              selectedTeam={selectedTeam}
              isRiderSelected={isRiderSelected}
              teamHasSelection={selectedTeam ? teamsWithSelection.has(selectedTeam) : false}
              canSelect={gameConfig.selectionStatus === 'open'}
              budgetRemaining={budgetStats.remaining}
              onSelectRider={selectRider}
              saving={saving}
            />
          </div>

          {/* Right column - My team */}
          <div className="lg:col-span-4">
            <FullGridMyTeam
              myTeam={myTeam}
              budgetStats={budgetStats}
              canEdit={gameConfig.selectionStatus === 'open'}
              onRemoveRider={removeRider}
              saving={saving}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
