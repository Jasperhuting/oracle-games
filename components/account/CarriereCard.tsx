'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { AvatarUpload } from './AvatarUpload';

interface TopResult {
  gameName: string;
  ranking: number;
  year: number;
  division?: string;
}

interface CarriereCardProps {
  userId: string;
  playername: string;
  dateOfBirth?: string;
  avatarUrl?: string;
  onAvatarUpdate?: (newAvatarUrl: string) => void;
}

export function CarriereCard({ userId, playername, dateOfBirth, avatarUrl, onAvatarUpdate }: CarriereCardProps) {
  const { t } = useTranslation();
  const [topResults, setTopResults] = useState<TopResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);

  // Update local state when prop changes
  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl);
  }, [avatarUrl]);

  const handleAvatarUpload = async (newAvatarUrl: string) => {
    try {
      const response = await fetch('/api/updateUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          playername,
          avatarUrl: newAvatarUrl,
        }),
      });

      if (response.ok) {
        setCurrentAvatarUrl(newAvatarUrl);
        onAvatarUpdate?.(newAvatarUrl);
      }
    } catch (error) {
      console.error('Error updating avatar:', error);
    }
  };

  // Calculate age from dateOfBirth
  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;

  useEffect(() => {
    async function fetchTopResults() {
      try {
        // Fetch user's game participations
        const response = await fetch(`/api/gameParticipants?userId=${userId}`);
        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const participants = data.participants || [];

        // Get game details for each participation
        const results: TopResult[] = [];

        for (const participant of participants) {
          const gameId = participant.gameId.replace(/-pending$/, '');
          if (!gameId || participant.ranking === 0) continue;

          try {
            const gameResponse = await fetch(`/api/games/${gameId}`);
            if (!gameResponse.ok) continue;

            const gameData = await gameResponse.json();
            const game = gameData.game;

            // Only include finished games for top results (exclude test games)
            if (game?.status === 'finished' && participant.ranking > 0 &&
                !game.isTest && !game.name?.toLowerCase().includes('test')) {
              results.push({
                gameName: game.name,
                ranking: participant.ranking,
                year: game.year || new Date().getFullYear(),
                division: game.division,
              });
            }
          } catch {
            // Skip games that fail to load
          }
        }

        // Sort by ranking (best first) and take top 5
        results.sort((a, b) => a.ranking - b.ranking);
        setTopResults(results.slice(0, 5));
      } catch (error) {
        console.error('Error fetching top results:', error);
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchTopResults();
    }
  }, [userId]);

  const formatRanking = (ranking: number): string => {
    if (ranking === 1) return '1e';
    if (ranking === 2) return '2e';
    if (ranking === 3) return '3e';
    return `${ranking}e`;
  };

  const formatYear = (year: number): string => {
    return `'${String(year).slice(-2)}`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Header with avatar and basic info */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <AvatarUpload
              currentAvatarUrl={currentAvatarUrl}
              onUploadSuccess={handleAvatarUpload}
              size={100}
            />
          </div>

          {/* Basic Info */}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{playername}</h2>
            {age && (
              <p className="text-gray-600 mb-1">
                <span className="font-medium">Leeftijd:</span> {age} jaar
              </p>
            )}
            <p className="text-sm text-gray-500">Profiel bijgewerkt</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prestaties</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Oracle Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 mb-1">-</div>
            <div className="text-sm font-medium text-gray-700 mb-1">Oracle Rank</div>
            <div className="text-xs text-gray-500">Komt binnenkort</div>
          </div>

          {/* Season Rank */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600 mb-1">-</div>
            <div className="text-sm font-medium text-gray-700 mb-1">Season Rank</div>
            <div className="text-xs text-gray-500">Komt binnenkort</div>
          </div>

          {/* Top Results Count */}
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 mb-1">
              {loading ? '...' : topResults.length}
            </div>
            <div className="text-sm font-medium text-gray-700 mb-1">Top Resultaten</div>
            <div className="text-xs text-gray-500">
              {loading ? 'Laden...' : topResults.length > 0 ? 'Beste prestaties' : 'Nog geen resultaten'}
            </div>
          </div>
        </div>
      </div>

      {/* Top Results Details */}
      <div className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Resultaten</h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500">Laden...</div>
        ) : topResults.length > 0 ? (
          <div className="space-y-3">
            {topResults.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {formatRanking(result.ranking)}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{result.gameName}</div>
                    {result.division && (
                      <div className="text-sm text-gray-500">{result.division}</div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 font-medium">
                  {formatYear(result.year)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <div className="text-lg mb-2">🏁</div>
            <div>Nog geen resultaten</div>
            <div className="text-sm text-gray-400 mt-1">Doe mee aan spellen om je prestaties te zien</div>
          </div>
        )}
      </div>

      {/* Action Links */}
      <div className="p-6 bg-gray-50 border-t border-gray-200">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            href="/account/settings"
            className="text-sm text-gray-700 hover:text-blue-600 hover:bg-white border border-gray-300 rounded-lg px-4 py-2 text-center transition-all duration-200 font-medium"
          >
            ⚙️ Voorkeuren
          </Link>
          <Link
            href="/account/stats"
            className="text-sm text-gray-700 hover:text-blue-600 hover:bg-white border border-gray-300 rounded-lg px-4 py-2 text-center transition-all duration-200 font-medium"
          >
            📊 Statistiek
          </Link>
          <Link
            href="/account/history"
            className="text-sm text-gray-700 hover:text-blue-600 hover:bg-white border border-gray-300 rounded-lg px-4 py-2 text-center transition-all duration-200 font-medium"
          >
            📜 Geschiedenis
          </Link>
          <Link
            href="/forum"
            className="text-sm text-gray-700 hover:text-blue-600 hover:bg-white border border-gray-300 rounded-lg px-4 py-2 text-center transition-all duration-200 font-medium"
          >
            💬 Forum
          </Link>
        </div>
      </div>
    </div>
  );
}

function calculateAge(dateOfBirth: string): number | null {
  try {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    return age > 0 && age < 150 ? age : null;
  } catch {
    return null;
  }
}
