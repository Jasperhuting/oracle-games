import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth, getServerFirebase } from '@/lib/firebase/server';
import { F1Standing, F1_COLLECTIONS } from '../../types';
import { cookies } from 'next/headers';

const f1Db = getServerFirebaseF1();
const defaultDb = getServerFirebase();

// Helper to get user from session
async function getUserFromSession(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;

    const auth = getServerAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch {
    return null;
  }
}

// GET /api/f1/standings?season=2026
// GET /api/f1/standings?season=2026&subLeagueId=xxx
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserFromSession();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const season = parseInt(searchParams.get('season') || new Date().getFullYear().toString());
    const subLeagueId = searchParams.get('subLeagueId');

    const standingsRef = f1Db.collection(F1_COLLECTIONS.STANDINGS);

    let standings: F1Standing[];

    if (subLeagueId) {
      // Get standings for specific subLeague
      const subLeagueDoc = await f1Db.collection(F1_COLLECTIONS.SUB_LEAGUES).doc(subLeagueId).get();
      const subLeagueData = subLeagueDoc.data();

      if (!subLeagueData) {
        return NextResponse.json(
          { success: false, error: 'SubLeague not found' },
          { status: 404 }
        );
      }

      // Check if user is member
      if (!subLeagueData.memberIds.includes(userId)) {
        return NextResponse.json(
          { success: false, error: 'Not a member of this subLeague' },
          { status: 403 }
        );
      }

      // Get standings for members only
      const memberIds = subLeagueData.memberIds as string[];
      
      // Firestore 'in' query supports max 30 items, so we need to batch if more
      const batches: string[][] = [];
      for (let i = 0; i < memberIds.length; i += 30) {
        batches.push(memberIds.slice(i, i + 30));
      }

      standings = [];
      for (const batch of batches) {
        const snapshot = await standingsRef
          .where('season', '==', season)
          .where('userId', 'in', batch)
          .get();
        standings.push(...snapshot.docs.map(doc => doc.data() as F1Standing));
      }
    } else {
      // Get all standings for season
      const snapshot = await standingsRef
        .where('season', '==', season)
        .orderBy('totalPoints', 'asc')
        .get();

      standings = snapshot.docs.map(doc => doc.data() as F1Standing);
    }

    // Sort by total points
    standings.sort((a, b) => a.totalPoints - b.totalPoints);

    // Enrich with user data from default database
    const enrichedStandings = await Promise.all(
      standings.map(async (standing) => {
        try {
          const userDoc = await defaultDb.collection('users').doc(standing.userId).get();
          const userData = userDoc.data();
          return {
            ...standing,
            userName: userData?.displayName || userData?.email || 'Unknown',
            userAvatar: userData?.photoURL || null,
          };
        } catch {
          return {
            ...standing,
            userName: 'Unknown',
            userAvatar: null,
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        standings: enrichedStandings,
        season,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching standings:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch standings' },
      { status: 500 }
    );
  }
}
