import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { userId, credentialId, publicKey, email } = await request.json();

    if (!userId || !credentialId || !publicKey) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if credential already exists
    const existingSnapshot = await db
      .collection('passkeys')
      .where('credentialId', '==', credentialId)
      .limit(1)
      .get();

    if (!existingSnapshot.empty) {
      return NextResponse.json(
        { error: 'Deze passkey is al geregistreerd' },
        { status: 409 }
      );
    }

    // Store passkey credential
    await db.collection('passkeys').add({
      userId,
      credentialId,
      publicKey,
      email,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error registering passkey:', error);
    return NextResponse.json(
      { error: 'Failed to register passkey', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
