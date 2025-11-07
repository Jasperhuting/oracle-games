import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { randomBytes } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { userId, type } = await request.json(); // type: 'registration' or 'authentication'

    if (!type) {
      return NextResponse.json(
        { error: 'Missing type field' },
        { status: 400 }
      );
    }

    // For registration, userId is required. For authentication, it's optional (challenge is stored by challenge ID)
    if (type === 'registration' && !userId) {
      return NextResponse.json(
        { error: 'userId is required for registration' },
        { status: 400 }
      );
    }

    // Generate cryptographically secure random challenge
    const challenge = randomBytes(32).toString('base64url');
    const challengeId = randomBytes(16).toString('base64url');

    const db = getServerFirebase();

    // Store challenge temporarily (expires in 5 minutes)
    // For authentication without userId, use challengeId as the document ID
    const docId = userId || challengeId;
    await db.collection('passkeyChallenge').doc(docId).set({
      challenge,
      type,
      challengeId,
      userId: userId || null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      used: false,
    });

    return NextResponse.json({ challenge, challengeId });
  } catch (error) {
    console.error('Error generating challenge:', error);
    return NextResponse.json(
      { error: 'Failed to generate challenge', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
