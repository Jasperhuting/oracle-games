import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { GameRule, GAME_TYPES, GameType, ClientGameRule } from '@/lib/types/games';
import type { GameRulesResponse, ApiErrorResponse } from '@/lib/types';

// GET /api/gameRules - Get all game rules
export async function GET(): Promise<NextResponse<GameRulesResponse | ApiErrorResponse>> {
  try {
    const db = getServerFirebase();
    const rulesSnapshot = await db.collection('gameRules').get();

    const rules: ClientGameRule[] = rulesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        gameType: data.gameType,
        rules: data.rules || '',
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedBy: data.updatedBy || '',
      } as ClientGameRule;
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching game rules:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game rules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/gameRules - Save or update game rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameType, rules, userId } = body;

    if (!gameType || !GAME_TYPES.includes(gameType)) {
      return NextResponse.json(
        { error: 'Valid game type is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const gameRuleData: Omit<GameRule, 'id'> = {
      gameType: gameType as GameType,
      rules: rules || '',
      updatedAt: new Date(),
      updatedBy: userId,
    };

    // Use gameType as document ID for easy retrieval
    await db.collection('gameRules').doc(gameType).set(gameRuleData);

    return NextResponse.json({
      success: true,
      gameType,
      message: 'Game rules saved successfully'
    });
  } catch (error) {
    console.error('Error saving game rules:', error);
    return NextResponse.json(
      { error: 'Failed to save game rules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
