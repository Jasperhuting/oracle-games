import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/race-config
 * Updates the four editable config fields for a single race document.
 *
 * Body: { userId, raceId, totalStages, hasPrologue, isSingleDay, excludeFromScraping }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, raceId, totalStages, hasPrologue, isSingleDay, excludeFromScraping } = body;

    if (!userId || !raceId) {
      return NextResponse.json({ error: 'userId and raceId are required' }, { status: 400 });
    }

    const db = getServerFirebase();

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    // Build only the fields that were explicitly provided
    const update: Record<string, unknown> = {};
    if (typeof totalStages === 'number') update.totalStages = totalStages;
    if (typeof hasPrologue === 'boolean') update.hasPrologue = hasPrologue;
    if (typeof isSingleDay === 'boolean') update.isSingleDay = isSingleDay;
    if (typeof excludeFromScraping === 'boolean') update.excludeFromScraping = excludeFromScraping;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    update.configUpdatedAt = new Date().toISOString();

    await db.collection('races').doc(raceId).set(update, { merge: true });

    return NextResponse.json({ success: true, raceId, updated: update });
  } catch (error) {
    console.error('[race-config] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update race config', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
