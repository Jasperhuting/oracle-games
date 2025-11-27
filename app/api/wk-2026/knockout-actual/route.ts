import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET() {
  try {
    const db = getServerFirebase();

    const doc = await db.collection('wk2026KnockoutActual').doc('results').get();

    if (!doc.exists) {
      return NextResponse.json({
        success: true,
        matches: [],
      });
    }

    return NextResponse.json({
      success: true,
      matches: doc.data()?.matches || [],
    });
  } catch (error) {
    console.error('Error fetching actual knockout results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch actual results' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { matches } = body;

    if (!matches) {
      return NextResponse.json(
        { error: 'matches are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    await db.collection('wk2026KnockoutActual').doc('results').set({
      matches,
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: 'Actual knockout results saved successfully',
    });
  } catch (error) {
    console.error('Error saving actual knockout results:', error);
    return NextResponse.json(
      { error: 'Failed to save actual results' },
      { status: 500 }
    );
  }
}
