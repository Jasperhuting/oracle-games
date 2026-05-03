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
  context: { params: Promise<{ gameId: string, notActive?: string }> }
): Promise<NextResponse<BidsListResponse | ApiErrorResponse>> {
  try {
    const { gameId, notActive } = await context.params; // ← FIX

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const riderNameId = searchParams.get('riderNameId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '100');
    const skipOrder = searchParams.get('skipOrder') === 'true';

    const db = getServerFirebase();

    // Determine if requesting user is admin or owner of requested bids
    const currentUserId = await getCurrentUserId(request);
    const isOwnBids = !userId || userId === currentUserId;

    if (!isOwnBids && currentUserId) {
      const userDoc = await db.collection('users').doc(currentUserId).get();
      const isAdmin = userDoc.data()?.userType === 'admin';
      if (!isAdmin && !isOwnBids) {
        // Non-admin viewing another player's bids: only show non-active (historical) bids
        // Active bids are secret during live auction rounds
        return jsonWithCacheVersion({
          success: true,
          bids: await (async () => {
            let q = db.collection('bids')
              .where('gameId', '==', gameId)
              .where('userId', '==', userId)
              .where('status', '!=', 'active');
            if (riderNameId) q = q.where('riderNameId', '==', riderNameId);
            if (!skipOrder) q = q.orderBy('bidAt', 'desc');
            q = q.limit(limit);
            const snap = await q.get();
            return snap.docs.map(doc => {
              const data = doc.data();
              return { id: doc.id, ...data, bidAt: data.bidAt?.toDate?.()?.toISOString() || data.bidAt } as ClientBid;
            });
          })(),
          count: 0,
        });
      }
    }

    let query = db.collection('bids').where('gameId', '==', gameId);

    if (notActive) query = query.where('status', '!=', 'active');
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