import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, loginMethod } = await request.json();

    if (!userId || !loginMethod) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Update last login method and timestamp
    await db.collection('users').doc(userId).update({
      lastLoginMethod: loginMethod,
      lastLoginAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating login method:', error);
    return NextResponse.json(
      { error: 'Failed to update login method', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
