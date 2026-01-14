import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Check if requesting user is admin
    const requestingUserDoc = await db.collection('users').doc(userId).get();
    if (!requestingUserDoc.exists || requestingUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all races, sorted by year descending
    const racesSnapshot = await db
      .collection('races')
      .orderBy('year', 'desc')
      .get();

    interface Race {
      id: string;
      hasResults?: boolean;
      resultsCount?: number;
      [key: string]: unknown;
    }

    // Helper to check if race has passed (finished)
    const isRacePassed = (raceData: FirebaseFirestore.DocumentData) => {
      const dateStr = raceData.endDate || raceData.startDate;
      if (!dateStr) return false;
      const raceDate = new Date(dateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return raceDate < today;
    };

    // Only check results for finished races (much faster)
    const racesWithResultsCheck = await Promise.all(
      racesSnapshot.docs.map(async (doc) => {
        const raceData = doc.data();
        const raceSlug = raceData.slug;
        const passed = isRacePassed(raceData);

        let hasResults = false;
        let resultsCount = 0;

        // Only check for results if race has finished
        if (passed && raceSlug) {
          try {
            const resultsSnapshot = await db
              .collection(raceSlug)
              .doc('stages')
              .collection('results')
              .get();

            hasResults = !resultsSnapshot.empty;
            resultsCount = resultsSnapshot.size;
          } catch {
            // Collection might not exist yet, that's fine
            hasResults = false;
          }
        }

        return {
          id: doc.id,
          ...raceData,
          hasResults,
          resultsCount,
        } as Race;
      })
    );

    return NextResponse.json({ races: racesWithResultsCheck });
  } catch (error) {
    console.error('Error fetching races:', error);
    return NextResponse.json(
      { error: 'Failed to fetch races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
