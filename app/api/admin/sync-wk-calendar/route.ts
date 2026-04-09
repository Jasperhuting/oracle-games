import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { syncWkToGoogleCalendar } from '@/lib/google-calendar/wkSync';

/**
 * POST /api/admin/sync-wk-calendar
 * Body: { userId }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const result = await syncWkToGoogleCalendar();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[sync-wk-calendar] Error:', error);
    return NextResponse.json(
      { error: 'WK calendar sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
