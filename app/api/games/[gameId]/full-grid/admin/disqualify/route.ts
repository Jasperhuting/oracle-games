import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/games/[gameId]/full-grid/admin/disqualify
 * Admin-only: cancels all bids for a user and withdraws them from the game.
 * Body: { adminUserId: string, targetUserId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
): Promise<NextResponse> {
  try {
    const { gameId } = await params;
    const body = await request.json();
    const { adminUserId, targetUserId } = body || {};

    if (!adminUserId || !targetUserId) {
      return NextResponse.json({ error: 'adminUserId en targetUserId zijn verplicht' }, { status: 400 });
    }

    const db = getServerFirebase();

    // Verify caller is admin
    const adminDoc = await db.collection('users').doc(String(adminUserId)).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 });
    }

    // Verify game exists and is full-grid
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Spel niet gevonden' }, { status: 404 });
    }
    if (gameDoc.data()?.gameType !== 'full-grid') {
      return NextResponse.json({ error: 'Geen Full Grid spel' }, { status: 400 });
    }

    // Verify target user is a participant
    const participantSnap = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', targetUserId)
      .limit(1)
      .get();

    if (participantSnap.empty) {
      return NextResponse.json({ error: 'Deelnemer niet gevonden in dit spel' }, { status: 404 });
    }

    const targetUserDoc = await db.collection('users').doc(String(targetUserId)).get();
    const targetPlayername = targetUserDoc.data()?.playername || targetUserDoc.data()?.email || targetUserId;

    // Cancel all bids for this user in this game
    const bidsSnap = await db.collection('bids')
      .where('gameId', '==', gameId)
      .where('userId', '==', targetUserId)
      .get();

    const now = Timestamp.now();
    const batch = db.batch();

    bidsSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: 'cancelled', cancelledAt: now });
    });

    // Mark participant as withdrawn
    batch.update(participantSnap.docs[0].ref, {
      status: 'withdrawn',
      withdrawnAt: now,
      withdrawnReason: 'disqualified_by_admin',
    });

    await batch.commit();

    // Log the action
    await db.collection('activityLogs').add({
      action: 'FULL_GRID_PARTICIPANT_DISQUALIFIED',
      userId: adminUserId,
      userName: adminDoc.data()?.playername || adminDoc.data()?.email,
      details: {
        gameId,
        gameName: gameDoc.data()?.name,
        targetUserId,
        targetPlayername,
        cancelledBids: bidsSnap.size,
      },
      timestamp: now,
    });

    return NextResponse.json({
      success: true,
      cancelledBids: bidsSnap.size,
      targetPlayername,
    });
  } catch (error) {
    console.error('Error disqualifying participant:', error);
    return NextResponse.json({ error: 'Diskwalificatie mislukt' }, { status: 500 });
  }
}
