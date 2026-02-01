'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { JoinableGameParticipant } from '@/lib/types';

interface F1GameParticipant {
  userId: string;
  gameId: string;
  season: number;
  displayName: string;
  joinedAt: any;
  status: 'active' | 'inactive';
}

export function useF1GameParticipants(gameId: string, season: number) {
  const { user } = useAuth();
  const [participants, setParticipants] = useState<JoinableGameParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadF1Participants() {
      try {
        setLoading(true);
        setError(null);

        // For F1 games, get participants from F1 database
        if (gameId === 'DeyPaxhoheF3v4qIwUs1') { // F1 game ID
          const response = await fetch(`/api/f1/participants?season=${season}`);
          if (!response.ok) {
            throw new Error('Failed to load F1 participants');
          }
          
          const data = await response.json();
          if (data.success && data.participants) {
            // Convert F1 participants to JoinableGameParticipant format
            const convertedParticipants: JoinableGameParticipant[] = data.participants.map((p: F1GameParticipant) => ({
              id: p.userId,
              gameId: p.gameId,
              userId: p.userId,
              playerName: p.displayName,
              joinedAt: p.joinedAt,
              status: p.status,
              // Add other required fields with defaults
              budget: 0,
              spentBudget: 0,
              rosterSize: 0,
              rosterComplete: false,
              totalPoints: 0,
              divisionAssigned: true,
              assignedDivision: 'Main',
              team: [],
              leagueIds: [],
            }));
            
            setParticipants(convertedParticipants);
          } else {
            setParticipants([]);
          }
        } else {
          // For non-F1 games, use the regular gameParticipants endpoint
          const response = await fetch(`/api/gameParticipants?gameId=${gameId}`);
          if (!response.ok) {
            throw new Error('Failed to load participants');
          }
          
          const data = await response.json();
          setParticipants(data.participants || []);
        }
      } catch (err) {
        console.error('Error loading participants:', err);
        setError(err instanceof Error ? err.message : 'Failed to load participants');
        setParticipants([]);
      } finally {
        setLoading(false);
      }
    }

    if (gameId && season) {
      loadF1Participants();
    } else {
      setLoading(false);
    }
  }, [gameId, season]);

  return { participants, loading, error };
}
