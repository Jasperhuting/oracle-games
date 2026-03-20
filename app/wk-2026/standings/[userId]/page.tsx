'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';
import { POULES, TeamInPoule } from '../../page';

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
}

interface PredictionDoc {
  id: string;
  userId: string;
  rankings: PouleRanking[];
  matches?: Match[];
}

export default function UserStandingDetailsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const userId = params.userId;

  const [prediction, setPrediction] = useState<PredictionDoc | null>(null);
  const [actualMatches, setActualMatches] = useState<Match[]>([]);
  const [teamNamesById, setTeamNamesById] = useState<Record<string, string>>({});
  const [playerName, setPlayerName] = useState(userId);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/wk-2026/predictions');
      return;
    }

    const fetchUserStandingDetails = async () => {
      try {
        setIsLoading(true);

        const [predictionResponse, poulesResponse, matchesResponse, userResponse] = await Promise.all([
          fetch(`/api/wk-2026/predictions/${userId}`),
          fetch('/api/wk-2026/getPoules'),
          fetch('/api/wk-2026/getMatches'),
          fetch(`/api/getUser?userId=${userId}`),
        ]);

        const predictionData = await predictionResponse.json();
        const poulesData = await poulesResponse.json();
        const matchesData = await matchesResponse.json();

        if (userResponse.ok) {
          const userData = await userResponse.json();
          setPlayerName(userData.playername || userData.firstName || userData.email || userId);
        }

        setPrediction(predictionData.predictions || null);

        const teamNames: Record<string, string> = {};
        POULES.forEach((pouleId) => {
          const pouleData = poulesData.poules?.find((entry: { pouleId: string }) => entry.pouleId === pouleId);
          if (!pouleData?.teams) return;

          Object.entries(pouleData.teams).forEach(([teamId, teamData]: [string, { name: string }]) => {
            teamNames[teamId] = teamData.name;
          });
        });

        setTeamNamesById(teamNames);
        setActualMatches((matchesData.matches || []).filter((match: Match) => match.team1Score !== null && match.team2Score !== null));
      } catch (error) {
        console.error('Error loading user standing details:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserStandingDetails();
  }, [loading, router, user, userId]);

  const playedPredictions = useMemo(() => {
    if (!prediction) return [];

    return actualMatches
      .map((actualMatch) => {
        const predictedMatch = prediction.matches?.find((entry) => entry.id === actualMatch.id);
        if (!predictedMatch || predictedMatch.team1Score === null || predictedMatch.team2Score === null) {
          return null;
        }

        return {
          ...actualMatch,
          predictedTeam1Score: predictedMatch.team1Score,
          predictedTeam2Score: predictedMatch.team2Score,
          isExact:
            predictedMatch.team1Score === actualMatch.team1Score &&
            predictedMatch.team2Score === actualMatch.team2Score,
        };
      })
      .filter((entry): entry is Match & { predictedTeam1Score: number; predictedTeam2Score: number; isExact: boolean } => entry !== null);
  }, [actualMatches, prediction]);

  return (
    <div className="p-8 mt-9 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{playerName}</h1>
          <p className="text-sm text-gray-600">
            Alleen de voorspellingen van wedstrijden waarvan de uitslag al is ingevoerd.
          </p>
        </div>
        <Link href="/wk-2026/standings" className="rounded-lg bg-white px-4 py-2 font-semibold text-[#9a4d00] hover:bg-[#fff0d9]">
          Terug naar standings
        </Link>
      </div>

      {isLoading && <div className="text-gray-600">Speler laden...</div>}

      {!isLoading && playedPredictions.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600">
          Er zijn nog geen gespeelde wedstrijden met voorspellingen voor deze speler.
        </div>
      )}

      {!isLoading && playedPredictions.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-700">Wedstrijd</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Uitslag</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Voorspelling</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-gray-700">Status</th>
              </tr>
            </thead>
            <tbody>
              {playedPredictions.map((match) => (
                <tr key={match.id} className="border-t">
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {(teamNamesById[match.team1Id] || match.team1Id)} - {(teamNamesById[match.team2Id] || match.team2Id)}
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                    {match.team1Score}-{match.team2Score}
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-800">
                    {match.predictedTeam1Score}-{match.predictedTeam2Score}
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    <span
                      className={`rounded-full px-3 py-1 font-semibold ${
                        match.isExact ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {match.isExact ? 'Exact goed' : 'Niet exact'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
