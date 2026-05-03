import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase, getServerAuth } from '@/lib/firebase/server';
import { cookies } from 'next/headers';
import type { BidsListResponse, ApiErrorResponse, ClientBid } from '@/lib/types';
import { jsonWithCacheVersion } from '@/lib/utils/apiCacheHeaders';

async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const idToken = authHeader.substring(7);
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
      } catch {}
    }
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

// GET all bids for a game
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ gameId: string }> }
): Promise<NextResponse<BidsListResponse | ApiErrorResponse>> {
  try {
    const { gameId } = await context.params;

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const riderNameId = searchParams.get('riderNameId');
    const status = searchParams.get('status');
    const notActive = searchParams.get('notActive') === 'true';
    const limit = parseInt(searchParams.get('limit') || '100');
    const skipOrder = searchParams.get('skipOrder') === 'true';

    const db = getServerFirebase();

    const currentUserId = await getCurrentUserId(request);
    const isOwnBids = !userId || userId === currentUserId;

    let isAdmin = false;
    if (currentUserId) {
      const userDoc = await db.collection('users').doc(currentUserId).get();
      isAdmin = userDoc.data()?.userType === 'admin';
    }

    // Two cases for non-admins viewing other players' data:
    //
    // 1. Specific player (userId param, != own): return ALL their bid statuses.
    //    The frontend only renders closed period tabs (active period tab is disabled),
    //    so active bids from the current round are never visible in the UI.
    //    This allows seeing active bids from closed periods (e.g. bid status not yet
    //    finalized to 'won' but rider already in playerTeam).
    //
    // 2. All-game bids (no userId): return only historical statuses to prevent
    //    seeing who is currently bidding on riders via riderBidders cards.
    if (!isAdmin && !isOwnBids) {
      // Case 1: specific other player — return all statuses, frontend handles period visibility
      let q = db.collection('bids').where('gameId', '==', gameId)
        .where('userId', '==', userId!);
      if (riderNameId) q = q.where('riderNameId', '==', riderNameId);
      if (!skipOrder) q = q.orderBy('bidAt', 'desc');
      q = q.limit(limit);
      const snap = await q.get();
      const bids = snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, bidAt: data.bidAt?.toDate?.()?.toISOString() || data.bidAt } as ClientBid;
      });
      return jsonWithCacheVersion({ success: true, bids, count: bids.length });
    }

    if (!isAdmin && !userId && !currentUserId) {
      // Case 2: unauthenticated all-game request — historical only
      const historicalStatuses = new Set(['won', 'lost', 'outbid', 'refunded']);
      let q = db.collection('bids').where('gameId', '==', gameId);
      if (riderNameId) q = q.where('riderNameId', '==', riderNameId);
      if (!skipOrder) q = q.orderBy('bidAt', 'desc');
      q = q.limit(limit);
      const snap = await q.get();
      const bids = snap.docs
        .map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, bidAt: data.bidAt?.toDate?.()?.toISOString() || data.bidAt } as ClientBid;
        })
        .filter(bid => historicalStatuses.has(bid.status));
      return jsonWithCacheVersion({ success: true, bids, count: bids.length });
    }

    let query = db.collection('bids').where('gameId', '==', gameId);

    if (notActive) query = query.where('status', 'in', ['won', 'lost', 'outbid', 'refunded']);
    if (userId) query = query.where('userId', '==', userId);
    if (riderNameId) query = query.where('riderNameId', '==', riderNameId);
    if (status) query = query.where('status', '==', status);

    if (!skipOrder) {
      query = query.orderBy('bidAt', 'desc');
    }
    query = query.limit(limit);

    const snapshot = await query.get();

    const bids = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        bidAt: data.bidAt?.toDate?.()?.toISOString() || data.bidAt,
      } as ClientBid;
    });

    return jsonWithCacheVersion({ success: true, bids, count: bids.length });
  } catch (error) {
    console.error('Error fetching bids:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bids', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}