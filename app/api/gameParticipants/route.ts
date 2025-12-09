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
      return {
        id: doc.id,
        ...data,
        joinedAt: data.joinedAt?.toDate?.()?.toISOString() || data.joinedAt,
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
