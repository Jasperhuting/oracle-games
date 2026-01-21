import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import type { GameParticipantsQueryResponse, ApiErrorResponse, ClientGameParticipant } from '@/lib/types';
import type { Query, CollectionReference, DocumentData } from 'firebase-admin/firestore';

export async function GET(request: NextRequest): Promise<NextResponse<GameParticipantsQueryResponse | ApiErrorResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const gameId = searchParams.get('gameId');

    if (!userId && !gameId) {
      return NextResponse.json(
        { error: 'Either userId or gameId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    let query: Query<DocumentData> | CollectionReference<DocumentData> = db.collection('gameParticipants');

    if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (gameId) {
      query = query.where('gameId', '==', gameId);
    }

    const snapshot = await query.get();

    const participants = snapshot.docs.map(doc => {
      const data = doc.data();

      // Convert team array timestamps to ISO strings
      let team = undefined;
      if (data.team) {
        // Handle case where team is stored as a string representation
        if (typeof data.team === 'string') {
          // Check if it's the corrupted "[object Object]" format
          if (data.team.includes('[object Object]')) {
            // This is corrupted data - we can't parse it, so set team to undefined
            console.warn('Corrupted team data detected for participant:', doc.id);
            team = undefined;
          } else if (data.team.startsWith('[') && data.team.endsWith(']')) {
            try {
              // Try to parse valid JSON strings
              const parsedTeam = JSON.parse(data.team);
              if (Array.isArray(parsedTeam)) {
                team = parsedTeam.map((rider: any) => ({
                  ...rider,
                  acquiredAt: rider.acquiredAt?.toDate?.()?.toISOString() || rider.acquiredAt,
                }));
              }
            } catch (error) {
              console.warn('Failed to parse team string:', error);
              // If parsing fails, leave team as undefined
            }
          }
        } else if (Array.isArray(data.team)) {
          // Handle case where team is already an array
          team = data.team.map((rider: any) => ({
            ...rider,
            acquiredAt: rider.acquiredAt?.toDate?.()?.toISOString() || rider.acquiredAt,
          }));
        }
      }

      return {
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt?.toDate?.()?.toISOString() || data.joinedAt,
        eliminatedAt: data.eliminatedAt?.toDate?.()?.toISOString() || data.eliminatedAt,
        team,
        // Handle leagueIds which might also be stored as a string
        leagueIds: (() => {
          if (!data.leagueIds) return [];
          if (Array.isArray(data.leagueIds)) return data.leagueIds;
          if (typeof data.leagueIds === 'string') {
            try {
              const parsed = JSON.parse(data.leagueIds);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          }
          return [];
        })(),
      } as ClientGameParticipant;
    });

    return NextResponse.json({
      success: true,
      participants,
      count: participants.length,
    });
  } catch (error) {
    console.error('Error fetching game participants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
