import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { scrapeCalendar } from '@/app/api/cron/scrape-race-calendar/route';

/**
 * POST /api/admin/sync-race-calendar
 * Admin-triggered race calendar sync (same logic as the cron, but with user auth).
 *
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

    return scrapeCalendar(Number(year));
  } catch (error) {
    console.error('[sync-race-calendar] Error:', error);
    return NextResponse.json(
      { error: 'Calendar sync failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
