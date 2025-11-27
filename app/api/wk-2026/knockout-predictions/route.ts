import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

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
