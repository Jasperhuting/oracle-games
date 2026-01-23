import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * POST /api/admin/reset-season-points
 *
 * Resets all seasonPoints for a specific year
 * Body: { userId, year }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, year } = await request.json();

    if (!userId || !year) {
      return NextResponse.json(
        { error: 'userId and year are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const yearNum = parseInt(year);
    console.log(`[RESET_SEASON_POINTS] Clearing season points for ${yearNum}`);

    // Delete all seasonPoints for this year
    const seasonPointsSnapshot = await db.collection('seasonPoints')
      .where('year', '==', yearNum)
      .get();

    if (seasonPointsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: `No season points found for year ${yearNum}`,
        deleted: 0,
      });
    }

    const batchSize = 500;
    const docs = seasonPointsSnapshot.docs;
    let deleted = 0;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);

      for (const doc of chunk) {
        batch.delete(doc.ref);
        deleted++;
      }

      await batch.commit();
    }

    console.log(`[RESET_SEASON_POINTS] Deleted ${deleted} season points documents for ${yearNum}`);

    return NextResponse.json({
      success: true,
      message: `Deleted ${deleted} season points documents for year ${yearNum}`,
      deleted,
    });

  } catch (error) {
    console.error('[RESET_SEASON_POINTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset season points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
