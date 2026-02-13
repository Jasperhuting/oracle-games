import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import * as admin from 'firebase-admin';

async function verifyAdminUser(db: admin.firestore.Firestore, userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists && userDoc.data()?.userType === 'admin';
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ participantId: string }> }
) {
  try {
    const { participantId } = await params;
    const { eligibleForPrizes } = await request.json();

    if (typeof eligibleForPrizes !== 'boolean') {
      return NextResponse.json(
        { error: 'eligibleForPrizes must be a boolean' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    const isAdmin = await verifyAdminUser(db, request.headers.get('userId'));
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const participantRef = db.collection('gameParticipants').doc(participantId);
    const participantDoc = await participantRef.get();

    if (!participantDoc.exists) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    await participantRef.update({ eligibleForPrizes });

    return NextResponse.json({ success: true, eligibleForPrizes });
  } catch (error) {
    console.error('Error updating prize eligibility:', error);
    return NextResponse.json(
      { error: 'Failed to update prize eligibility', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
