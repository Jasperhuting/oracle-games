import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerFirebaseFootball } from '@/lib/firebase/server';
import { WK2026_COLLECTIONS, createWkParticipantDocId } from '@/app/wk-2026/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    const doc = await db.collection('wk2026KnockoutPredictions').doc(userId).get();

    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        prediction: null,
      });
    }

    return NextResponse.json({
      success: true,
      prediction: doc.data(),
    });
  } catch (error) {
    console.error('Error fetching knockout predictions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, matches } = body;

    if (!userId || !matches) {
      return NextResponse.json(
        { error: 'userId and matches are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    const footballDb = getServerFirebaseFootball();

    const participantDoc = await footballDb
      .collection(WK2026_COLLECTIONS.PARTICIPANTS)
      .doc(createWkParticipantDocId(userId, 2026))
      .get();

    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'User must join WK 2026 before saving predictions' },
        { status: 403 }
      );
    }

    await db.collection('wk2026KnockoutPredictions').doc(userId).set({
      userId,
      matches,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Knockout predictions saved successfully',
    });
  } catch (error) {
    console.error('Error saving knockout predictions:', error);
    return NextResponse.json(
      { error: 'Failed to save predictions' },
      { status: 500 }
    );
  }
}
