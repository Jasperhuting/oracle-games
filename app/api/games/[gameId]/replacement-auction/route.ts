import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * POST /api/games/[gameId]/replacement-auction
 *
 * Opens a replacement rider auction period for a Giro Auction Master game.
 * Called by admin when riders have dropped out and budget needs to be re-bid.
 *
 * Creates a new auctionPeriod ending at 22:00 CET today, sets game to 'bidding'.
 *
 * Body: { adminUserId: string, reason?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const body = await request.json().catch(() => ({}));
  const { adminUserId, reason } = body;

  if (!adminUserId) {
    return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
  }

  const db = getServerFirebase();

  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  const gameData = gameDoc.data()!;
  if (gameData.gameType !== 'auctioneer') {
    return NextResponse.json({ error: 'Only available for auctioneer games' }, { status: 400 });
  }

  // Build deadline: today at 22:00 Europe/Amsterdam
  const now = new Date();
  const deadline = new Date(now);
  deadline.setHours(22, 0, 0, 0);

  // If it's already past 22:00, set deadline to tomorrow 22:00
  if (now >= deadline) {
    deadline.setDate(deadline.getDate() + 1);
  }

  const periodName = `Replacement ${deadline.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit' })}`;

  const existingPeriods: unknown[] = Array.isArray(gameData.config?.auctionPeriods)
    ? gameData.config.auctionPeriods
    : [];

  // Check if a replacement period already exists for today
  const todayStr = deadline.toDateString();
  const alreadyOpen = existingPeriods.some((p: unknown) => {
    if (!p || typeof p !== 'object') return false;
    const period = p as { name?: string; endDate?: { toDate?: () => Date } };
    const endDate = period.endDate?.toDate?.();
    return period.name?.startsWith('Replacement') && endDate?.toDateString() === todayStr;
  });

  if (alreadyOpen) {
    return NextResponse.json(
      { error: `Replacement auction already open for today (${periodName})` },
      { status: 409 }
    );
  }

  const newPeriod = {
    name: periodName,
    startDate: Timestamp.fromDate(now),
    endDate: Timestamp.fromDate(deadline),
    finalizeDate: Timestamp.fromDate(deadline),
    status: 'open',
    isReplacement: true,
    reason: reason || 'rider_dnf',
  };

  const updatedPeriods = [...existingPeriods, newPeriod];

  await gameDoc.ref.update({
    status: 'bidding',
    'config.auctionPeriods': updatedPeriods,
    updatedAt: Timestamp.now(),
  });

  await db.collection('activityLogs').add({
    action: 'REPLACEMENT_AUCTION_OPENED',
    userId: adminUserId,
    details: {
      gameId,
      gameName: gameData.name,
      periodName,
      deadline: deadline.toISOString(),
      reason: reason || 'rider_dnf',
    },
    timestamp: Timestamp.now(),
  });

  return NextResponse.json({
    success: true,
    message: `Replacement auction opened until ${deadline.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`,
    periodName,
    deadline: deadline.toISOString(),
  });
}

/**
 * DELETE /api/games/[gameId]/replacement-auction
 *
 * Closes the active replacement auction (sets status back to 'active').
 * Normally handled by the finalize endpoint, but available as manual override.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  const { gameId } = await params;

  const { searchParams } = new URL(request.url);
  const adminUserId = searchParams.get('adminUserId');

  if (!adminUserId) {
    return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
  }

  const db = getServerFirebase();

  const adminDoc = await db.collection('users').doc(adminUserId).get();
  if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const gameDoc = await db.collection('games').doc(gameId).get();
  if (!gameDoc.exists) {
    return NextResponse.json({ error: 'Game not found' }, { status: 404 });
  }

  await gameDoc.ref.update({
    status: 'active',
    updatedAt: Timestamp.now(),
  });

  return NextResponse.json({ success: true, message: 'Replacement auction closed, game set to active' });
}
