import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, challenge, clientDataJSON } = await request.json();

    if (!userId || !challenge) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Get stored challenge
    const challengeDoc = await db.collection('passkeyChallenge').doc(userId).get();

    if (!challengeDoc.exists) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    const challengeData = challengeDoc.data();

    // Verify challenge hasn't been used
    if (challengeData?.used) {
      return NextResponse.json(
        { error: 'Challenge already used' },
        { status: 400 }
      );
    }

    // Verify challenge hasn't expired
    const expiresAt = new Date(challengeData?.expiresAt);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Challenge expired' },
        { status: 400 }
      );
    }

    // Verify challenge matches
    if (challengeData?.challenge !== challenge) {
      return NextResponse.json(
        { error: 'Invalid challenge' },
        { status: 400 }
      );
    }

    // Mark challenge as used
    await challengeDoc.ref.update({
      used: true,
      usedAt: new Date().toISOString(),
    });

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying challenge:', error);
    return NextResponse.json(
      { error: 'Failed to verify challenge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
