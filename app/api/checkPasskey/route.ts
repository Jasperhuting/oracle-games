import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();
    
    // Check if user has any passkeys
    const passkeysSnapshot = await db
      .collection('passkeys')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (passkeysSnapshot.empty) {
      return NextResponse.json({
        hasPasskey: false,
      });
    }

    const passkeyDoc = passkeysSnapshot.docs[0];
    const passkeyData = passkeyDoc.data();

    return NextResponse.json({
      hasPasskey: true,
      lastUsedAt: passkeyData.lastUsedAt,
      createdAt: passkeyData.createdAt,
    });
  } catch (error) {
    console.error('Error checking passkey:', error);
    return NextResponse.json(
      { error: 'Failed to check passkey', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
