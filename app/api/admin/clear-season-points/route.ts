import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

/**
 * DELETE /api/admin/clear-season-points?year=2026
 *
 * Clears all season points for a given year.
 * Admin only - requires userId query param for auth check.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const userId = searchParams.get('userId');

    if (!year) {
      return NextResponse.json(
        { error: 'Year parameter is required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
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
    if (isNaN(yearNum)) {
      return NextResponse.json(
        { error: 'Invalid year parameter' },
        { status: 400 }
      );
    }

    console.log(`[CLEAR_SEASON_POINTS] Clearing all season points for year ${yearNum}`);

    // Query all seasonPoints documents for this year
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

    // Delete all documents in batches
    const batchSize = 500;
    let deleted = 0;
    const docs = seasonPointsSnapshot.docs;

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + batchSize);

      for (const doc of chunk) {
        batch.delete(doc.ref);
        deleted++;
      }

      await batch.commit();
      console.log(`[CLEAR_SEASON_POINTS] Deleted batch of ${chunk.length} documents`);
    }

    console.log(`[CLEAR_SEASON_POINTS] Successfully deleted ${deleted} season points documents for year ${yearNum}`);

    return NextResponse.json({
      success: true,
      message: `Cleared all season points for year ${yearNum}`,
      deleted,
    });

  } catch (error) {
    console.error('[CLEAR_SEASON_POINTS] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear season points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
