import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getStageResult } from '@/lib/scraper/getStageResult';
import { KNOWN_RACE_SLUGS, type RaceSlug } from '@/lib/scraper/types';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';

// Helper function to remove undefined values from objects
function cleanData(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(cleanData).filter(item => item !== undefined);
  }
  
  if (obj && typeof obj === 'object') {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = cleanData(value);
      }
    }
    return cleaned;
  }
  
  return obj;
}

// Helper function to convert string to slug
function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to enrich riders with data from rankings
async function enrichRiders(riders: any[], year: number, db: any) {
  const enrichedRiders = [];
  
  for (const rider of riders) {
    // Try to find rider in rankings by shortName
    const riderSlug = toSlug(rider.shortName || '');
    
    if (!riderSlug) {
      enrichedRiders.push(rider);
      continue;
    }

    try {
      const riderDoc = await db.collection(`rankings_${year}`).doc(riderSlug).get();
      
      if (riderDoc.exists) {
        const riderData = riderDoc.data();
        
        // Preserve original points field (e.g., points gained on stage) if it exists
        // Only add ranking points if there's no existing points field
        const enrichedRider: any = {
          ...rider,
          nameID: riderData.nameID || rider.shortName,
          rank: riderData.rank,
          jerseyImage: riderData.jerseyImage || '',
        };
        
        // Only add ranking points if rider doesn't already have a points field
        // (to preserve stage points in classifications)
        if (rider.points === undefined) {
          enrichedRider.rankingPoints = riderData.points;
        }
        
        enrichedRiders.push(enrichedRider);
      } else {
        console.warn(`Rider ${rider.shortName} not found in rankings_${year}`);
        enrichedRiders.push(rider);
      }
    } catch (error) {
      console.error(`Error enriching rider ${rider.shortName}:`, error);
      enrichedRiders.push(rider);
    }
  }
  
  return enrichedRiders;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, raceSlug, year, stage } = await request.json();

    if (!userId || !raceSlug || !year || !stage) {
      return NextResponse.json(
        { error: 'User ID, race slug, year, and stage are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    const userDataCheck = userDoc.data();
    
    console.log('[saveStageResult] Admin check:', {
      userId,
      userExists: userDoc.exists,
      userType: userDataCheck?.userType,
      isAdmin: userDataCheck?.userType === 'admin'
    });
    
    if (!userDoc.exists || userDataCheck?.userType !== 'admin') {
      return NextResponse.json(
        { 
          error: 'Unauthorized - Admin access required',
          debug: {
            userExists: userDoc.exists,
            userType: userDataCheck?.userType
          }
        },
        { status: 403 }
      );
    }

    // Extract race name from slug (remove year suffix)
    const raceName = raceSlug.replace(/_\d{4}$/, '') as RaceSlug;

    // Validate race slug
    if (!KNOWN_RACE_SLUGS.includes(raceName)) {
      return NextResponse.json(
        { error: `Unknown race slug '${raceName}'. Valid slugs: ${KNOWN_RACE_SLUGS.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`[saveStageResult] Fetching stage ${stage} for ${raceName} ${year}`);

    // Fetch stage result from ProCyclingStats
    const stageData = await getStageResult({
      race: raceName,
      year: parseInt(year),
      stage: stage,
    });

    console.log(`[saveStageResult] Scraped ${stageData.stageResults.length} riders for stage ${stage}`);

    // Enrich riders with data from rankings
    console.log(`[saveStageResult] Enriching riders from rankings_${year}`);
    const enrichedStageResults = await enrichRiders(stageData.stageResults || [], parseInt(year), db);
    const enrichedGeneralClassification = await enrichRiders(stageData.generalClassification || [], parseInt(year), db);
    const enrichedPointsClassification = await enrichRiders(stageData.pointsClassification || [], parseInt(year), db);
    const enrichedMountainsClassification = await enrichRiders(stageData.mountainsClassification || [], parseInt(year), db);
    const enrichedYouthClassification = await enrichRiders(stageData.youthClassification || [], parseInt(year), db);
    
    console.log(`[saveStageResult] Enriched ${enrichedStageResults.length} stage results`);

    // Clean the data to remove undefined values
    const cleanedData = cleanData({
      stage: stage,
      race: raceName,
      year: parseInt(year),
      stageTitle: stageData.stageResults[0] ? `Stage ${stage}` : '',
      stageResults: enrichedStageResults,
      generalClassification: enrichedGeneralClassification,
      pointsClassification: enrichedPointsClassification,
      mountainsClassification: enrichedMountainsClassification,
      youthClassification: enrichedYouthClassification,
      teamClassification: stageData.teamClassification || [],
      scrapedAt: stageData.scrapedAt,
      source: stageData.source,
    });

    // Save to Firestore in a subcollection under the race
    const stageDocRef = db.collection(raceSlug).doc('stages').collection('results').doc(`stage-${stage}`);
    await stageDocRef.set(cleanedData);

    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'STAGE_RESULT_SAVED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        raceSlug,
        stage,
        ridersCount: stageData.stageResults.length,
      },
      timestamp: new Date().toISOString(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Trigger points calculation for all affected games
    console.log(`[saveStageResult] Triggering points calculation for ${raceSlug} stage ${stage}`);
    try {
      // Create a mock request for the calculate-points endpoint
      const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
        method: 'POST',
        body: JSON.stringify({
          raceSlug,
          stage,
          year,
        }),
      });

      const calculatePointsResponse = await calculatePoints(mockRequest);
      const pointsResult = await calculatePointsResponse.json();
      
      if (calculatePointsResponse.status === 200) {
        console.log('[saveStageResult] Points calculation completed:', pointsResult);
      } else {
        console.error('[saveStageResult] Failed to calculate points:', pointsResult);
      }
    } catch (error) {
      console.error('[saveStageResult] Error triggering points calculation:', error);
      // Don't fail the whole request if points calculation fails
    }

    return NextResponse.json({ 
      success: true,
      stage,
      ridersCount: stageData.stageResults.length,
      message: `Stage ${stage} resultaten succesvol opgeslagen`
    });
  } catch (error) {
    console.error('Error saving stage result:', error);
    return NextResponse.json(
      { error: 'Failed to save stage result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
