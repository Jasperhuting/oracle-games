import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || '2026');

    const db = getServerFirebase();

    // Get all rankings for this year, sorted by rank descending
    const rankingsSnapshot = await db.collection(`rankings_${year}`)
      .orderBy('rank', 'desc')
      .limit(100) // Get top 100 to find placeholder ranks (9999, 9998, etc.)
      .get();

    const usedRanks = new Set<number>();
    rankingsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.rank >= 9900) { // Only consider placeholder ranks
        usedRanks.add(data.rank);
      }
    });

    // Find the next available rank starting from 9999 going down
    let nextRank = 9999;
    while (usedRanks.has(nextRank) && nextRank >= 9900) {
      nextRank--;
    }

    return NextResponse.json({
      nextAvailableRank: nextRank,
      usedRanks: Array.from(usedRanks).sort((a, b) => b - a),
    });

  } catch (error) {
    console.error('Error finding next available rank:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find next available rank' },
      { status: 500 }
    );
  }
}
