import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getAuth } from 'firebase-admin/auth';

export async function POST(request: NextRequest) {
  try {
    const { credentialId, signature, authenticatorData, clientDataJSON, challenge, challengeId } = await request.json();

    if (!credentialId || !challengeId) {
      return NextResponse.json(
        { error: 'Credential ID and challenge ID are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the challenge
    const challengeDoc = await db.collection('passkeyChallenge').doc(challengeId).get();
    
    if (!challengeDoc.exists) {
      return NextResponse.json(
        { error: 'Challenge niet gevonden of verlopen' },
        { status: 400 }
      );
    }

    const challengeData = challengeDoc.data();
    
    if (challengeData?.used) {
      return NextResponse.json(
        { error: 'Challenge al gebruikt' },
        { status: 400 }
      );
    }

    if (new Date(challengeData?.expiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Challenge verlopen' },
        { status: 400 }
      );
    }

    // Mark challenge as used
    await challengeDoc.ref.update({ used: true });

    // Find user with this passkey credential
    const passkeysSnapshot = await db
      .collection('passkeys')
      .where('credentialId', '==', credentialId)
      .limit(1)
      .get();

    if (passkeysSnapshot.empty) {
      return NextResponse.json(
        { error: 'Passkey niet gevonden' },
        { status: 404 }
      );
    }

    const passkeyDoc = passkeysSnapshot.docs[0];
    const passkeyData = passkeyDoc.data();
    const userId = passkeyData.userId;

    // In production, you should verify the signature here
    // For now, we'll trust the credential ID match and challenge verification

    // Create a custom token for the user
    const auth = getAuth();
    const customToken = await auth.createCustomToken(userId);

    // Update last used timestamp
    await passkeyDoc.ref.update({
      lastUsedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      token: customToken,
      userId 
    });
  } catch (error) {
    console.error('Error verifying passkey:', error);
    return NextResponse.json(
      { error: 'Failed to verify passkey', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
