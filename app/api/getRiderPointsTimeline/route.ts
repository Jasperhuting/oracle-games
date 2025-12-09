import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Fetch all playerTeams with points
    const playerTeamsSnapshot = await db
      .collection('playerTeams')
      .where('pointsScored', '>', 0)
      .get();

    // Fetch all stage results to get dates
    const racesSnapshot = await db.collection('races').get();
    const stageResultsMap = new Map<string, Map<number, { date: Date; raceName: string }>>();

    for (const raceDoc of racesSnapshot.docs) {
      const raceSlug = raceDoc.id;
      const raceData = raceDoc.data();
      const raceName = raceData.name || raceSlug;

      const stagesSnapshot = await raceDoc.ref.collection('stages').get();
      const stageMap = new Map<number, { date: Date; raceName: string }>();

      stagesSnapshot.forEach((stageDoc) => {
        const stageData = stageDoc.data();
        const stageNum = stageData.stage;
        const scrapedAt = stageData.scrapedAt?.toDate() || new Date();
        
        stageMap.set(stageNum, {
          date: scrapedAt,
          raceName,
        });
      });

      stageResultsMap.set(raceSlug, stageMap);
    }

    interface RiderPointsData {
      riderNameId: string;
      riderName: string;
      riderTeam: string;
      riderCountry: string;
      jerseyImage: string;
      totalPoints: number;
      pointsByDate: Array<{ 
        date: string; 
        stage: number;
        raceSlug: string;
        raceName: string;
        points: number;
        breakdown: {
          stageResult: number;
          gcPoints: number;
          pointsClass: number;
          mountainsClass: number;
          youthClass: number;
          mountainPoints: number;
          sprintPoints: number;
          combativityBonus: number;
          teamPoints: number;
        };
      }>;
    }
    
    // Build rider points data
    const ridersMap = new Map<string, RiderPointsData>();

    playerTeamsSnapshot.forEach((doc) => {
      const data = doc.data();
      
      if (!data.racePoints) return;

      const riderId = data.riderNameId;
      
      if (!ridersMap.has(riderId)) {
        ridersMap.set(riderId, {
          riderNameId: riderId,
          riderName: data.riderName,
          riderTeam: data.riderTeam,
          riderCountry: data.riderCountry,
          jerseyImage: data.jerseyImage,
          totalPoints: data.pointsScored,
          pointsByDate: [],
        });
      }

      const riderData = ridersMap.get(riderId);

      // Process race points
      Object.entries(data.racePoints).forEach(([raceSlug, raceData]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        Object.entries(raceData.stagePoints).forEach(([stageNum, stageData]: [string, any]) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          const stageNumber = parseInt(stageNum);
          
          // Get actual stage date
          const raceStages = stageResultsMap.get(raceSlug);
          const stageInfo = raceStages?.get(stageNumber);
          
          const date = stageInfo?.date || new Date();
          const raceName = stageInfo?.raceName || raceSlug.split('_')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          riderData?.pointsByDate.push({
            date: date.toISOString(),
            stage: stageNumber,
            raceSlug,
            raceName,
            points: stageData.total,
            breakdown: {
              stageResult: stageData.stageResult,
              gcPoints: stageData.gcPoints,
              pointsClass: stageData.pointsClass,
              mountainsClass: stageData.mountainsClass,
              youthClass: stageData.youthClass,
              mountainPoints: stageData.mountainPoints,
              sprintPoints: stageData.sprintPoints,
              combativityBonus: stageData.combativityBonus,
              teamPoints: stageData.teamPoints,
            },
          });
        });
      });

      // Sort by date
      riderData?.pointsByDate.sort((a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    });

    const riders = Array.from(ridersMap.values());

    return NextResponse.json({
      success: true,
      riders,
    });
  } catch (error) {
    console.error('Error fetching rider points timeline:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch rider points timeline',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
