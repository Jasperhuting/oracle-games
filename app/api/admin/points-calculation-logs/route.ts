import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const statusFilter = searchParams.get('status') || 'failed';

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    let query: FirebaseFirestore.Query = db
      .collection('activityLogs')
      .where('action', '==', 'POINTS_CALCULATION')
      .orderBy('timestamp', 'desc')
      .limit(200);

    const snapshot = await query.get();
    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((log: any) => {
        if (statusFilter === 'all') return true;
        return log?.details?.success === false || log?.details?.status !== 200;
      })
      .map((log: any) => ({
        id: log.id,
        timestamp: log.timestamp?.toDate?.().toISOString?.() || log.timestamp,
        details: log.details || {},
      }));

    return NextResponse.json({ success: true, logs });
  } catch (error) {
    console.error('Error fetching points calculation logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch points calculation logs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
