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

    // Fetch all documents from the race collection
    const raceDataSnapshot = await db
      .collection(raceSlug)
      .get();

    interface RaceStageData {
      id: string;
      stage?: number;
      date?: string;
      scrapedAt?: unknown;
      [key: string]: unknown;
    }
    
    const data: RaceStageData[] = [];
    
    // Process each document and resolve team references
    for (const doc of raceDataSnapshot.docs) {
      const docData = doc.data();
      const processedData: RaceStageData = {
        id: doc.id,
        ...docData
      };

      // If rider has a team reference, fetch the team data
      if (docData.rider?.team && typeof docData.rider.team === 'object' && docData.rider.team._firestore) {
        try {
          const teamDoc = await docData.rider.team.get();
          if (teamDoc.exists) {
            processedData.rider = {
              ...docData.rider,
              team: teamDoc.data()
            };
          }
        } catch (error) {
          console.error('Error fetching team reference:', error);
        }
      }

      data.push(processedData);
    }

    return NextResponse.json({ 
      raceSlug,
      count: data.length,
      data 
    });
  } catch (error) {
    console.error('Error fetching race data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch race data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
