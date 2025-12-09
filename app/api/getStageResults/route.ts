import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const raceSlug = searchParams.get('raceSlug');

    if (!userId || !raceSlug) {
      return NextResponse.json(
        { error: 'User ID and race slug are required' },
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

    // Fetch all stage results from the subcollection
    const stagesSnapshot = await db
      .collection(raceSlug)
      .doc('stages')
      .collection('results')
      .orderBy('stage', 'asc')
      .get();

    interface StageData {
      id: string;
      stage?: number;
      [key: string]: unknown;
    }
    
    const stages: StageData[] = [];
    stagesSnapshot.forEach((doc) => {
      stages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return NextResponse.json({ 
      raceSlug,
      count: stages.length,
      stages 
    });
  } catch (error) {
    console.error('Error fetching stage results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stage results', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
