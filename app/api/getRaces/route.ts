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

    // Fetch all races
    const racesSnapshot = await db
      .collection('races')
      .orderBy('year', 'desc')
      .orderBy('createdAt', 'desc')
      .get();

    const races: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    racesSnapshot.forEach((doc) => {
      races.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return NextResponse.json({ races });
  } catch (error) {
    console.error('Error fetching races:', error);
    return NextResponse.json(
      { error: 'Failed to fetch races', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
