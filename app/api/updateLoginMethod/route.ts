import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

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
    const userRef = db.collection('users').doc(userId);

    // Check if user document exists
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update existing user document
    await userRef.update({
      lastLoginMethod: loginMethod,
      lastLoginAt: Timestamp.now(),
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