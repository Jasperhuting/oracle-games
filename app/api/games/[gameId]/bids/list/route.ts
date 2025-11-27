import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

// GET all bids for a game
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await context.params; // ← FIX

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const riderNameId = searchParams.get('riderNameId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');

    const db = getServerFirebase();

    let query = db.collection('bids').where('gameId', '==', gameId);

    if (userId) query = query.where('userId', '==', userId);
    if (riderNameId) query = query.where('riderNameId', '==', riderNameId);
    if (status) query = query.where('status', '==', status);

    query = query.orderBy('bidAt', 'desc').limit(limit);

    const snapshot = await query.get();

    const bids = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        bidAt: data.bidAt?.toDate?.()?.toISOString() || data.bidAt,
      };
    });

    return NextResponse.json({ success: true, bids, count: bids.length });
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}