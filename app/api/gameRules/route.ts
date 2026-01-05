import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { ClientGameRule } from '@/lib/types/games';
import type { GameRulesResponse, ApiErrorResponse } from '@/lib/types';
import { Timestamp } from 'firebase-admin/firestore';

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
        categoryId: data.categoryId || null,
        displayName: data.displayName || null,
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

// Helper to convert display name to slug
const toSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

// POST /api/gameRules - Save or update game rules
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameType, categoryId, rules, userId, displayName, isNew } = body;

    // For new games, generate slug from displayName
    const slug = isNew && displayName ? toSlug(displayName) : gameType;

    if (!slug) {
      return NextResponse.json(
        { error: 'Game type or display name is required' },
        { status: 400 }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json(
        { error: 'Invalid game type format. Use only lowercase letters, numbers, and hyphens.' },
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

    // For new games, check if slug already exists
    if (isNew) {
      const existingDoc = await db.collection('gameRules').doc(slug).get();
      if (existingDoc.exists) {
        return NextResponse.json(
          { error: 'A game with this name already exists' },
          { status: 400 }
        );
      }
    }

    const gameRuleData: Record<string, unknown> = {
      gameType: slug,
      categoryId: categoryId || null,
      rules: rules || '',
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    };

    // Add displayName for new games or if provided
    if (displayName) {
      gameRuleData.displayName = displayName;
    }

    // Use gameType as document ID for easy retrieval
    await db.collection('gameRules').doc(slug).set(gameRuleData, { merge: true });

    return NextResponse.json({
      success: true,
      gameType: slug,
      displayName: displayName || null,
      message: isNew ? 'New game type created successfully' : 'Game rules saved successfully'
    });
  } catch (error) {
    console.error('Error saving game rules:', error);
    return NextResponse.json(
      { error: 'Failed to save game rules', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
