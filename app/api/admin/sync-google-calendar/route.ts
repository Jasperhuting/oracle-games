import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { syncRacesToGoogleCalendar } from '@/lib/google-calendar/raceSync';

/**
 * POST /api/admin/sync-google-calendar
 * Body: { userId, year }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, year } = await request.json();

    if (!userId || !year) {
      return NextResponse.json({ error: 'userId and year are required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const result = await syncRacesToGoogleCalendar(Number(year));
    return NextResponse.json(result);
  } catch (error) {
    console.error('[sync-google-calendar] Error:', error);
    return NextResponse.json(
      { error: 'Google Calendar sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
