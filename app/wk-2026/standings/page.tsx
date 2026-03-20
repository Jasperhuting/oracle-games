'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { POULES, TeamInPoule } from '../page';
import { useWk2026Participant, useWk2026SubLeagues } from '../hooks';
import { Wk2026SubLeague } from '../types';

interface PouleRanking {
  pouleId: string;
  rankings: (TeamInPoule | null)[];
}

interface Match {
  id: string;
  pouleId: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
  isLive?: boolean;
}

interface PredictionDoc {
  id: string;
  userId: string;
  rankings: PouleRanking[];
  matches?: Match[];
}

interface TeamStats {
  teamId: string;
  team: TeamInPoule;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

interface UserStanding {
  userId: string;
  userName: string;
  exactScores: number;
  correctPlacements: number;
  totalPredictions: number;
}

export default function WkStandingsPage() {
  const { user, loading } = useAuth();
  const { isParticipant, loading: participantLoading, refresh: refreshParticipant } = useWk2026Participant(user?.uid || null, 2026);
  const { subLeagues, loading: subLeaguesLoading, refresh: refreshSubLeagues } = useWk2026SubLeagues(user?.uid || null, 2026);
  const router = useRouter();

  const [allPredictions, setAllPredictions] = useState<PredictionDoc[]>([]);
  const [actualPoules, setActualPoules] = useState<PouleRanking[]>([]);
  const [actualMatches, setActualMatches] = useState<Match[]>([]);
  const [baseMatches, setBaseMatches] = useState<Match[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [liveScoresData, setLiveScoresData] = useState<unknown[]>([]);
  const [isLoadingStandings, setIsLoadingStandings] = useState(true);
  const [selectedSubpoule, setSelectedSubpoule] = useState<string | null>(null);
  const [showSubpouleTools, setShowSubpouleTools] = useState(false);
  const [newSubpouleName, setNewSubpouleName] = useState('');
  const [newSubpouleDescription, setNewSubpouleDescription] = useState('');
  const [newSubpouleIsPublic, setNewSubpouleIsPublic] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isJoiningCompetition, setIsJoiningCompetition] = useState(false);
  const [isCreatingSubpoule, setIsCreatingSubpoule] = useState(false);
  const [isJoiningSubpoule, setIsJoiningSubpoule] = useState(false);
  const [leavingSubpouleId, setLeavingSubpouleId] = useState<string | null>(null);
  const [publicSubLeagues, setPublicSubLeagues] = useState<Wk2026SubLeague[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [requestingSubpouleId, setRequestingSubpouleId] = useState<string | null>(null);
  const [managingSubLeagueId, setManagingSubLeagueId] = useState<string | null>(null);
  const [pendingUserNames, setPendingUserNames] = useState<Record<string, string>>({});

  const getTeamById = useCallback((teamId: string): TeamInPoule | null => {
    for (const poule of actualPoules) {
      const team = poule.rankings.find((entry) => entry?.id === teamId);
      if (team) return team;
    }

    return null;
  }, [actualPoules]);

  const fetchStandingsData = useCallback(async () => {
    try {
      setIsLoadingStandings(true);

      const [predictionsResponse, poulesResponse, matchesResponse, liveScoresResponse] = await Promise.all([
        fetch('/api/wk-2026/predictions'),
        fetch('/api/wk-2026/getPoules'),
        fetch('/api/wk-2026/getMatches'),
        fetch('/api/wk-2026/livescores'),
      ]);

      const predictionsData = await predictionsResponse.json();
      const poulesData = await poulesResponse.json();
      const matchesData = await matchesResponse.json();
      const liveScores = await liveScoresResponse.json();

      const predictions: PredictionDoc[] = predictionsData.predictions || [];
      setAllPredictions(predictions);
      setLiveScoresData(liveScores || []);

      const poulesRankings: PouleRanking[] = POULES.map((pouleId) => {
        const pouleData = poulesData.poules?.find((entry: { pouleId: string }) => entry.pouleId === pouleId);

        if (pouleData?.teams) {
          const rankings: (TeamInPoule | null)[] = [null, null, null, null];

          Object.entries(pouleData.teams).forEach(([teamId, teamData]: [string, { position: number; name: string; pot: number }]) => {
            if (teamData.position !== null && teamData.position !== undefined) {
              rankings[teamData.position] = {
                id: teamId,
                name: teamData.name,
                pot: teamData.pot,
                poule: pouleId,
                position: teamData.position,
              };
            }
          });

          return { pouleId, rankings };
        }

        return { pouleId, rankings: [null, null, null, null] };
      });

      setActualPoules(poulesRankings);

      const matches: Match[] = [];
      poulesRankings.forEach((poule) => {
        const teams = poule.rankings.filter((entry) => entry !== null) as TeamInPoule[];

        for (let i = 0; i < teams.length; i += 1) {
          for (let j = i + 1; j < teams.length; j += 1) {
            const matchId = `${poule.pouleId}-${teams[i].id}-${teams[j].id}`;
            const savedMatch = matchesData.matches?.find((entry: { id: string }) => entry.id === matchId);

            matches.push({
              id: matchId,
              pouleId: poule.pouleId,
              team1Id: teams[i].id,
              team2Id: teams[j].id,
              team1Score: savedMatch?.team1Score ?? null,
              team2Score: savedMatch?.team2Score ?? null,
            });
          }
        }
      });

      setBaseMatches(matches);

      const nameEntries = await Promise.all(
        predictions.map(async (prediction) => {
          try {
            const response = await fetch(`/api/getUser?userId=${prediction.userId}`);
            if (!response.ok) {
              return [prediction.userId, prediction.userId] as [string, string];
            }

            const userData = await response.json();
            return [
              prediction.userId,
              userData.playername || userData.firstName || userData.email || prediction.userId,
            ] as [string, string];
          } catch {
            return [prediction.userId, prediction.userId] as [string, string];
          }
        }),
      );

      setUserNames(
        nameEntries.reduce<Record<string, string>>((accumulator, [id, name]) => {
          accumulator[id] = name;
          return accumulator;
        }, {}),
      );
    } catch (error) {
      console.error('Error loading user standings:', error);
    } finally {
      setIsLoadingStandings(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026/predictions');
      return;
    }

    if (participantLoading || !isParticipant) {
      setIsLoadingStandings(false);
      return;
    }

    fetchStandingsData();
  }, [user, loading, router, participantLoading, isParticipant, fetchStandingsData]);

  useEffect(() => {
    if (selectedSubpoule && !subLeagues.some((league) => league.id === selectedSubpoule)) {
      setSelectedSubpoule(null);
    }
  }, [selectedSubpoule, subLeagues]);

  useEffect(() => {
    if (!isParticipant) {
      setPublicSubLeagues([]);
      return;
    }

    const fetchPublicSubLeagues = async () => {
      try {
        setBrowseLoading(true);
        const response = await fetch('/api/wk-2026/subleagues?public=true');
        const data = await response.json();

        if (response.ok && data.success) {
          setPublicSubLeagues(data.data || []);
        }
      } catch (error) {
        console.error('Error fetching public subpoules:', error);
      } finally {
        setBrowseLoading(false);
      }
    };

    fetchPublicSubLeagues();
  }, [isParticipant]);

  useEffect(() => {
    const managingLeague = subLeagues.find((league) => league.id === managingSubLeagueId && league.createdBy === user?.uid);
    const pendingIds = managingLeague?.pendingMemberIds || [];

    if (pendingIds.length === 0) {
      setPendingUserNames({});
      return;
    }

    const fetchPendingNames = async () => {
      try {
        const response = await fetch(`/api/users/names?ids=${pendingIds.join(',')}`);
        const data = await response.json();
        if (response.ok && data.success) {
          setPendingUserNames(data.data || {});
        }
      } catch (error) {
        console.error('Error fetching pending user names:', error);
      }
    };

    fetchPendingNames();
  }, [managingSubLeagueId, subLeagues, user?.uid]);

  useEffect(() => {
    if (baseMatches.length === 0) {
      setActualMatches([]);
      return;
    }

    const updatedMatches = baseMatches.map((match) => {
      const team1 = getTeamById(match.team1Id);
      const team2 = getTeamById(match.team2Id);

      if (!team1 || !team2) {
        return match;
      }

      const liveScore = liveScoresData.find((entry: {
        homeTeam: string;
        awayTeam: string;
        homeScore: number;
        awayScore: number;
        gameIsFinished: boolean;
      }) => {
        const matchesForward = entry.homeTeam === team1.id && entry.awayTeam === team2.id;
        const matchesReverse = entry.homeTeam === team2.id && entry.awayTeam === team1.id;
        return matchesForward || matchesReverse;
      });

      if (liveScore && !liveScore.gameIsFinished) {
        const isReversed = liveScore.homeTeam === team2.id;

        return {
          ...match,
          team1Score: isReversed ? liveScore.awayScore : liveScore.homeScore,
          team2Score: isReversed ? liveScore.homeScore : liveScore.awayScore,
          isLive: true,
        };
      }

      return { ...match, isLive: false };
    });

    setActualMatches(updatedMatches);
  }, [baseMatches, getTeamById, liveScoresData]);

  const calculateStandings = useCallback((pouleId: string): TeamStats[] => {
    const pouleData = actualPoules.find((entry) => entry.pouleId === pouleId);
    if (!pouleData) return [];

    const teams = pouleData.rankings.filter((entry) => entry !== null) as TeamInPoule[];
    const pouleMatches = actualMatches.filter((entry) => entry.pouleId === pouleId);

    const statsMap: Record<string, TeamStats> = {};
    teams.forEach((team) => {
      statsMap[team.id] = {
        teamId: team.id,
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
      };
    });

    pouleMatches.forEach((match) => {
      if (match.team1Score === null || match.team2Score === null) return;

      const team1Stats = statsMap[match.team1Id];
      const team2Stats = statsMap[match.team2Id];
      if (!team1Stats || !team2Stats) return;

      team1Stats.played += 1;
      team2Stats.played += 1;

      team1Stats.goalsFor += match.team1Score;
      team1Stats.goalsAgainst += match.team2Score;
      team2Stats.goalsFor += match.team2Score;
      team2Stats.goalsAgainst += match.team1Score;

      if (match.team1Score > match.team2Score) {
        team1Stats.won += 1;
        team1Stats.points += 3;
        team2Stats.lost += 1;
      } else if (match.team1Score < match.team2Score) {
        team2Stats.won += 1;
        team2Stats.points += 3;
        team1Stats.lost += 1;
      } else {
        team1Stats.drawn += 1;
        team2Stats.drawn += 1;
        team1Stats.points += 1;
        team2Stats.points += 1;
      }

      team1Stats.goalDifference = team1Stats.goalsFor - team1Stats.goalsAgainst;
      team2Stats.goalDifference = team2Stats.goalsFor - team2Stats.goalsAgainst;
    });

    return Object.values(statsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });
  }, [actualMatches, actualPoules]);

  const userStandings = useMemo<UserStanding[]>(() => {
    if (allPredictions.length === 0) return [];

    return allPredictions
      .map((prediction) => {
        const correctPlacements = POULES.reduce((total, pouleId) => {
          const actualRanking = calculateStandings(pouleId).map((entry) => entry.team);
          const predictedRanking =
            prediction.rankings?.find((entry) => entry.pouleId === pouleId)?.rankings ?? [null, null, null, null];

          const pouleCorrect = predictedRanking.reduce((count, team, index) => {
            const actualTeam = actualRanking[index] || null;
            return team && actualTeam && team.id === actualTeam.id ? count + 1 : count;
          }, 0);

          return total + pouleCorrect;
        }, 0);

        const exactScores = actualMatches.reduce((total, match) => {
          if (match.team1Score === null || match.team2Score === null) {
            return total;
          }

          const predictedMatch = prediction.matches?.find((entry) => entry.id === match.id);
          if (
            predictedMatch &&
            predictedMatch.team1Score === match.team1Score &&
            predictedMatch.team2Score === match.team2Score
          ) {
            return total + 1;
          }

          return total;
        }, 0);

        return {
          userId: prediction.userId,
          userName: userNames[prediction.userId] || prediction.userId,
          exactScores,
          correctPlacements,
          totalPredictions: (prediction.matches || []).filter(
            (entry) => entry.team1Score !== null && entry.team2Score !== null,
          ).length,
        };
      })
      .sort((a, b) => {
        if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
        if (b.correctPlacements !== a.correctPlacements) return b.correctPlacements - a.correctPlacements;
        return a.userName.localeCompare(b.userName);
      });
  }, [actualMatches, allPredictions, calculateStandings, userNames]);

  const selectedSubLeague = useMemo(
    () => subLeagues.find((league) => league.id === selectedSubpoule) ?? null,
    [selectedSubpoule, subLeagues],
  );
  const managingSubLeague = useMemo(
    () => subLeagues.find((league) => league.id === managingSubLeagueId && league.createdBy === user?.uid) ?? null,
    [managingSubLeagueId, subLeagues, user?.uid],
  );

  const filteredUserStandings = useMemo(() => {
    if (!selectedSubLeague) {
      return userStandings;
    }

    const memberIds = new Set(selectedSubLeague.memberIds);
    return userStandings.filter((standing) => memberIds.has(standing.userId));
  }, [selectedSubLeague, userStandings]);

  const handleJoinCompetition = async () => {
    if (!user) return;

    setIsJoiningCompetition(true);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/wk-2026/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ season: 2026 }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Aanmelden voor WK 2026 is mislukt' });
        return;
      }

      await refreshParticipant();
      setFeedbackMessage({ type: 'success', text: 'Je doet nu mee aan WK 2026. Je kunt direct voorspellen en subpoules gebruiken.' });
    } catch (error) {
      console.error('Error joining WK 2026:', error);
      setFeedbackMessage({ type: 'error', text: 'Aanmelden voor WK 2026 is mislukt' });
    } finally {
      setIsJoiningCompetition(false);
    }
  };

  const handleCreateSubpoule = async () => {
    if (!user || !newSubpouleName.trim()) return;

    setIsCreatingSubpoule(true);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/wk-2026/subleagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: newSubpouleName.trim(),
          description: newSubpouleDescription.trim(),
          isPublic: newSubpouleIsPublic,
          season: 2026,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Subpoule aanmaken is mislukt' });
        return;
      }

      setNewSubpouleName('');
      setNewSubpouleDescription('');
      setNewSubpouleIsPublic(false);
      await refreshSubLeagues();
      setSelectedSubpoule(data.data.id);
      setFeedbackMessage({
        type: 'success',
        text: `Subpoule aangemaakt. Deel code ${data.data.code} met je vrienden.`,
      });
    } catch (error) {
      console.error('Error creating subpoule:', error);
      setFeedbackMessage({ type: 'error', text: 'Subpoule aanmaken is mislukt' });
    } finally {
      setIsCreatingSubpoule(false);
    }
  };

  const handleJoinSubpoule = async () => {
    if (!user || !joinCode.trim()) return;

    setIsJoiningSubpoule(true);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/wk-2026/subleagues', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ code: joinCode.trim().toUpperCase() }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Subpoule joinen is mislukt' });
        return;
      }

      setJoinCode('');
      await refreshSubLeagues();
      setSelectedSubpoule(data.data.id);
      setFeedbackMessage({ type: 'success', text: `Je bent toegevoegd aan ${data.data.name}.` });
    } catch (error) {
      console.error('Error joining subpoule:', error);
      setFeedbackMessage({ type: 'error', text: 'Subpoule joinen is mislukt' });
    } finally {
      setIsJoiningSubpoule(false);
    }
  };

  const handleLeaveSubpoule = async (league: Wk2026SubLeague) => {
    if (!user || !league.id) return;

    const confirmText = league.createdBy === user.uid
      ? `Weet je zeker dat je ${league.name} wilt verwijderen?`
      : `Weet je zeker dat je ${league.name} wilt verlaten?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setLeavingSubpouleId(league.id);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/wk-2026/subleagues?id=${league.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Subpoule verlaten is mislukt' });
        return;
      }

      if (selectedSubpoule === league.id) {
        setSelectedSubpoule(null);
      }

      await refreshSubLeagues();
      setFeedbackMessage({
        type: 'success',
        text: league.createdBy === user.uid ? 'Subpoule verwijderd.' : 'Je hebt de subpoule verlaten.',
      });
    } catch (error) {
      console.error('Error leaving subpoule:', error);
      setFeedbackMessage({ type: 'error', text: 'Subpoule verlaten is mislukt' });
    } finally {
      setLeavingSubpouleId(null);
    }
  };

  const handlePublicSubpouleAction = async (leagueId: string, action: 'request' | 'cancel') => {
    if (!user) return;

    setRequestingSubpouleId(leagueId);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/wk-2026/subleagues/${leagueId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Actie op subpoule is mislukt' });
        return;
      }

      setFeedbackMessage({
        type: 'success',
        text: action === 'request' ? 'Aanvraag verstuurd.' : 'Aanvraag geannuleerd.',
      });

      await refreshSubLeagues();
      const refreshResponse = await fetch('/api/wk-2026/subleagues?public=true');
      const refreshData = await refreshResponse.json();
      if (refreshResponse.ok && refreshData.success) {
        setPublicSubLeagues(refreshData.data || []);
      }
    } catch (error) {
      console.error('Error handling public subpoule action:', error);
      setFeedbackMessage({ type: 'error', text: 'Actie op subpoule is mislukt' });
    } finally {
      setRequestingSubpouleId(null);
    }
  };

  const handleManageRequest = async (targetUserId: string, action: 'approve' | 'reject') => {
    if (!user || !managingSubLeague?.id) return;

    setRequestingSubpouleId(`${managingSubLeague.id}:${targetUserId}:${action}`);
    setFeedbackMessage(null);

    try {
      const idToken = await user.getIdToken();
      const response = await fetch(`/api/wk-2026/subleagues/${managingSubLeague.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action, targetUserId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedbackMessage({ type: 'error', text: data.error || 'Aanvraag verwerken is mislukt' });
        return;
      }

      setFeedbackMessage({
        type: 'success',
        text: action === 'approve' ? 'Aanvraag goedgekeurd.' : 'Aanvraag afgewezen.',
      });
      await refreshSubLeagues();
    } catch (error) {
      console.error('Error managing subpoule request:', error);
      setFeedbackMessage({ type: 'error', text: 'Aanvraag verwerken is mislukt' });
    } finally {
      setRequestingSubpouleId(null);
    }
  };

  if (loading || participantLoading || subLeaguesLoading) {
    return (
      <div className="p-8 mt-9 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-[#ffd7a6] bg-white p-6 text-[#9a4d00]">
          WK 2026 laden...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!isParticipant) {
    return (
      <div className="p-8 mt-9 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-[#ffd7a6] bg-white p-8 shadow-sm">
          <span className="inline-flex rounded-full bg-[#fff0d9] px-3 py-1 text-sm font-semibold text-[#9a4d00]">
            Eerst deelnemen
          </span>
          <h1 className="mt-4 text-3xl font-bold text-gray-900">Doe eerst mee aan WK 2026</h1>
          <p className="mt-3 max-w-2xl text-base text-gray-600">
            Zodra je deelneemt krijg je toegang tot predictions, standings en je eigen subpoules.
          </p>
          <button
            type="button"
            onClick={handleJoinCompetition}
            disabled={isJoiningCompetition}
            className="mt-6 rounded-xl bg-[#ff9900] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#e68a00] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isJoiningCompetition ? 'Bezig met aanmelden...' : 'Deelnemen aan WK 2026'}
          </button>
          {feedbackMessage && (
            <p className={`mt-4 text-sm ${feedbackMessage.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
              {feedbackMessage.text}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 mt-9 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">WK 2026 - Tussenstand</h1>
      <p className="mb-6 text-sm text-gray-600">
        Overzicht van alle spelers, gesorteerd op exacte uitslagen en daarna op correcte eindposities per poule.
      </p>

      <div className="mb-6 rounded-3xl border border-[#ffd7a6] bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900">Subpoules</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubpoule(null)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                  selectedSubpoule === null
                    ? 'bg-[#ff9900] text-white'
                    : 'bg-[#fff0d9] text-[#9a4d00] hover:bg-[#ffe3b8]'
                }`}
              >
                Algemeen
              </button>
              {subLeagues.map((league) => (
                <button
                  key={league.id}
                  type="button"
                  onClick={() => setSelectedSubpoule(league.id || null)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedSubpoule === league.id
                      ? 'bg-[#ff9900] text-white'
                      : 'bg-[#fff0d9] text-[#9a4d00] hover:bg-[#ffe3b8]'
                  }`}
                >
                  {league.name} <span className="opacity-75">({league.memberIds.length})</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-start">
            <button
              type="button"
              onClick={() => setShowSubpouleTools((current) => !current)}
              className="rounded-xl border border-[#ff9900] px-4 py-3 text-sm font-semibold text-[#9a4d00] transition-colors hover:bg-[#fff0d9]"
            >
              {showSubpouleTools ? 'Subpoule opties sluiten' : 'Subpoule aanmaken of joinen'}
            </button>
          </div>
        </div>

        {showSubpouleTools && (
          <div className="mt-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#ffe0b6] bg-[#fffaf3] p-4">
                <label className="mb-2 block text-sm font-semibold text-[#9a4d00]">Nieuwe subpoule</label>
                <input
                  value={newSubpouleName}
                  onChange={(event) => setNewSubpouleName(event.target.value)}
                  placeholder="Bijv. Familie Oranje"
                  className="w-full rounded-xl border border-[#ffd7a6] bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#ff9900]"
                />
                <textarea
                  value={newSubpouleDescription}
                  onChange={(event) => setNewSubpouleDescription(event.target.value)}
                  placeholder="Korte beschrijving voor een publieke subpoule"
                  rows={3}
                  className="mt-3 w-full rounded-xl border border-[#ffd7a6] bg-white px-4 py-3 text-sm text-gray-900 outline-none transition-colors focus:border-[#ff9900]"
                />
                <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={newSubpouleIsPublic}
                    onChange={(event) => setNewSubpouleIsPublic(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-[#ff9900] focus:ring-[#ff9900]"
                  />
                  Publieke subpoule met aanvragen
                </label>
                <button
                  type="button"
                  onClick={handleCreateSubpoule}
                  disabled={isCreatingSubpoule || !newSubpouleName.trim()}
                  className="mt-3 w-full rounded-xl bg-[#ff9900] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#e68a00] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isCreatingSubpoule ? 'Aanmaken...' : 'Subpoule aanmaken'}
                </button>
              </div>

              <div className="rounded-2xl border border-[#ffe0b6] bg-[#fffaf3] p-4">
                <label className="mb-2 block text-sm font-semibold text-[#9a4d00]">Join met code</label>
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="ABC123"
                  className="w-full rounded-xl border border-[#ffd7a6] bg-white px-4 py-3 text-sm uppercase tracking-[0.2em] text-gray-900 outline-none transition-colors focus:border-[#ff9900]"
                />
                <button
                  type="button"
                  onClick={handleJoinSubpoule}
                  disabled={isJoiningSubpoule || !joinCode.trim()}
                  className="mt-3 w-full rounded-xl border border-[#ff9900] bg-white px-4 py-3 text-sm font-semibold text-[#9a4d00] transition-colors hover:bg-[#fff0d9] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isJoiningSubpoule ? 'Bezig...' : 'Join subpoule'}
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-[#ffe0b6] bg-[#fffaf3] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-gray-900">Publieke subpoules</h3>
                  {browseLoading && <span className="text-xs text-[#9a4d00]">Laden...</span>}
                </div>

                <div className="space-y-3">
                  {publicSubLeagues.length === 0 && (
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600">
                      Er zijn nog geen publieke subpoules.
                    </div>
                  )}

                  {publicSubLeagues.map((league) => {
                    const isMember = league.memberIds.includes(user.uid);
                    const isPending = (league.pendingMemberIds || []).includes(user.uid);

                    return (
                      <div key={league.id} className="rounded-xl border border-[#ffd7a6] bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-gray-900">{league.name}</p>
                            {league.description && (
                              <p className="mt-1 text-sm text-gray-600">{league.description}</p>
                            )}
                            <p className="mt-2 text-xs text-[#9a4d00]">
                              {league.memberIds.length} leden
                              {league.pendingMemberIds?.length ? ` • ${league.pendingMemberIds.length} openstaande aanvragen` : ''}
                            </p>
                          </div>

                          {!isMember && (
                            <button
                              type="button"
                              onClick={() => handlePublicSubpouleAction(league.id!, isPending ? 'cancel' : 'request')}
                              disabled={requestingSubpouleId === league.id}
                              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                isPending
                                  ? 'border border-[#ff9900] text-[#9a4d00] hover:bg-[#fff0d9]'
                                  : 'bg-[#ff9900] text-white hover:bg-[#e68a00]'
                              }`}
                            >
                              {requestingSubpouleId === league.id
                                ? 'Bezig...'
                                : isPending
                                  ? 'Aanvraag annuleren'
                                  : 'Aanvragen'}
                            </button>
                          )}

                          {isMember && (
                            <span className="rounded-full bg-[#fff0d9] px-3 py-1 text-xs font-semibold text-[#9a4d00]">
                              Lid
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-[#ffe0b6] bg-[#fffaf3] p-4">
                <div className="mb-3">
                  <h3 className="text-sm font-semibold text-gray-900">Beheer aanvragen</h3>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {subLeagues.filter((league) => league.createdBy === user.uid).map((league) => (
                    <button
                      key={league.id}
                      type="button"
                      onClick={() => setManagingSubLeagueId(league.id || null)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        managingSubLeagueId === league.id
                          ? 'bg-[#ff9900] text-white'
                          : 'bg-white text-[#9a4d00] hover:bg-[#fff0d9]'
                      }`}
                    >
                      {league.name}
                      {(league.pendingMemberIds?.length || 0) > 0 ? ` (${league.pendingMemberIds.length})` : ''}
                    </button>
                  ))}
                </div>

                {!managingSubLeague && (
                  <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600">
                    Kies hierboven een subpoule die jij beheert.
                  </div>
                )}

                {managingSubLeague && (
                  <div className="space-y-3">
                    {(!managingSubLeague.pendingMemberIds || managingSubLeague.pendingMemberIds.length === 0) && (
                      <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600">
                        Geen openstaande aanvragen voor {managingSubLeague.name}.
                      </div>
                    )}

                    {(managingSubLeague.pendingMemberIds || []).map((pendingUserId) => (
                      <div key={pendingUserId} className="flex items-center justify-between gap-3 rounded-xl border border-[#ffd7a6] bg-white p-4">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {pendingUserNames[pendingUserId] || pendingUserId}
                          </p>
                          <p className="text-xs text-gray-500">{pendingUserId}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleManageRequest(pendingUserId, 'approve')}
                            disabled={requestingSubpouleId === `${managingSubLeague.id}:${pendingUserId}:approve`}
                            className="rounded-xl bg-[#ff9900] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e68a00] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Goedkeuren
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManageRequest(pendingUserId, 'reject')}
                            disabled={requestingSubpouleId === `${managingSubLeague.id}:${pendingUserId}:reject`}
                            className="rounded-xl border border-[#ff9900] px-4 py-2 text-sm font-semibold text-[#9a4d00] hover:bg-[#fff0d9] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Afwijzen
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {selectedSubLeague && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#ffe0b6] bg-[#fffaf3] p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">{selectedSubLeague.name}</p>
              <p className="text-sm text-gray-600">
                Code: <span className="font-mono font-semibold text-[#9a4d00]">{selectedSubLeague.code}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleLeaveSubpoule(selectedSubLeague)}
              disabled={leavingSubpouleId === selectedSubLeague.id}
              className="rounded-xl border border-[#ff9900] px-4 py-2 text-sm font-semibold text-[#9a4d00] transition-colors hover:bg-[#fff0d9] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {leavingSubpouleId === selectedSubLeague.id
                ? 'Bezig...'
                : selectedSubLeague.createdBy === user.uid
                  ? 'Subpoule verwijderen'
                  : 'Subpoule verlaten'}
            </button>
          </div>
        )}

        {feedbackMessage && (
          <p className={`mt-4 text-sm ${feedbackMessage.type === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {feedbackMessage.text}
          </p>
        )}
      </div>

      {isLoadingStandings && <div className="text-gray-600">Tussenstand laden...</div>}

      {!isLoadingStandings && filteredUserStandings.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          {selectedSubLeague
            ? 'Er zijn nog geen voorspellingen beschikbaar in deze subpoule.'
            : 'Er zijn nog geen voorspellingen beschikbaar.'}
        </div>
      )}

      {!isLoadingStandings && filteredUserStandings.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              {selectedSubLeague ? `${selectedSubLeague.name} klassement` : 'Gebruikersklassement'}
            </h2>
            <p className="text-sm text-gray-600">
              Klik op een naam om alleen de al gespeelde wedstrijden en voorspellingen van die speler te bekijken.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border-2 border-gray-300 bg-white">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700">Speler</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Exacte scores</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Correcte posities</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Ingevulde scores</th>
              </tr>
            </thead>
            <tbody>
              {filteredUserStandings.map((standing, index) => (
                <tr
                  key={standing.userId}
                  className={`border-t ${
                    standing.userId === user?.uid
                      ? 'bg-orange-100'
                      : index < 3
                        ? 'bg-[#fff7eb]'
                        : 'bg-white'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{index + 1}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link
                      href={`/wk-2026/standings/${standing.userId}`}
                      className="transition-colors hover:text-[#ff9900] hover:underline"
                    >
                      {standing.userName}
                      {standing.userId === user?.uid ? ' (jij)' : ''}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-[#9a4d00]">
                    {standing.exactScores}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-800">{standing.correctPlacements}</td>
                  <td className="px-4 py-3 text-center text-sm text-gray-800">{standing.totalPredictions}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}
