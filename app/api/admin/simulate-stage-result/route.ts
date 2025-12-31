import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { POST as calculatePoints } from '@/app/api/games/calculate-points/route';

/**
 * Simulate a stage result for testing purposes
 * This creates fake stage results and triggers the points calculation pipeline
 */
export async function POST(request: NextRequest) {
  try {
    const { userId, raceSlug, stage, numRiders } = await request.json();

    if (!userId || !raceSlug || !stage || !numRiders) {
      return NextResponse.json(
        { error: 'userId, raceSlug, stage, and numRiders are required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userDoc.exists || userData?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Extract year from race slug
    const yearMatch = raceSlug.match(/_(\d{4})$/);
    if (!yearMatch) {
      return NextResponse.json(
        { error: 'Invalid race slug format (must end with _YYYY)' },
        { status: 400 }
      );
    }
    const year = parseInt(yearMatch[1]);

    console.log(`[SIMULATE] Generating fake stage result for ${raceSlug} stage ${stage} with ${numRiders} riders`);

    // Get random riders from rankings collection
    const rankingsCollection = `rankings_${year}`;
    const ridersSnapshot = await db.collection(rankingsCollection)
      .limit(numRiders * 2) // Get more than needed in case some don't have required data
      .get();

    if (ridersSnapshot.empty) {
      return NextResponse.json(
        { error: `No riders found in ${rankingsCollection}` },
        { status: 404 }
      );
    }

    // Shuffle and select riders
    const allRiders = ridersSnapshot.docs
      .map(doc => ({
        nameID: doc.id,
        shortName: doc.data().name || doc.id,
        rank: doc.data().rank || 999,
        points: doc.data().points || 0,
        jerseyImage: doc.data().jerseyImage || '',
        team: doc.data().team || { name: 'Unknown Team' },
      }))
      .filter(r => r.shortName && r.nameID);

    // Shuffle array
    const shuffledRiders = allRiders.sort(() => Math.random() - 0.5);
    const selectedRiders = shuffledRiders.slice(0, numRiders);

    // Generate stage results
    const stageResults = selectedRiders.map((rider, index) => ({
      rank: index + 1,
      nameID: rider.nameID,
      shortName: rider.shortName,
      rankingPoints: rider.points,
      rankingRank: rider.rank,
      jerseyImage: rider.jerseyImage,
      team: rider.team,
    }));

    // Generate GC (same riders, slightly different order)
    const gcResults = [...selectedRiders]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(20, numRiders))
      .map((rider, index) => ({
        rank: index + 1,
        nameID: rider.nameID,
        shortName: rider.shortName,
        rankingPoints: rider.points,
        rankingRank: rider.rank,
        jerseyImage: rider.jerseyImage,
      }));

    // Generate points classification (top 15)
    const pointsResults = [...selectedRiders]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(15, numRiders))
      .map((rider, index) => ({
        rank: index + 1,
        nameID: rider.nameID,
        shortName: rider.shortName,
        points: Math.max(1, Math.floor(Math.random() * 50)), // Random points 1-50
        rankingPoints: rider.points,
        rankingRank: rider.rank,
        jerseyImage: rider.jerseyImage,
      }));

    // Generate mountains classification (top 10)
    const mountainsResults = [...selectedRiders]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(10, numRiders))
      .map((rider, index) => ({
        rank: index + 1,
        nameID: rider.nameID,
        shortName: rider.shortName,
        points: Math.max(1, Math.floor(Math.random() * 30)), // Random points 1-30
        rankingPoints: rider.points,
        rankingRank: rider.rank,
        jerseyImage: rider.jerseyImage,
      }));

    // Generate youth classification (top 10, only young riders)
    const youthResults = [...selectedRiders]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(10, numRiders))
      .map((rider, index) => ({
        rank: index + 1,
        nameID: rider.nameID,
        shortName: rider.shortName,
        rankingPoints: rider.points,
        rankingRank: rider.rank,
        jerseyImage: rider.jerseyImage,
      }));

    // Create the stage result document
    const stageData = {
      stage: stage,
      race: raceSlug.replace(/_\d{4}$/, ''),
      year: year,
      stageTitle: `Stage ${stage} (Simulated)`,
      stageResults,
      generalClassification: gcResults,
      pointsClassification: pointsResults,
      mountainsClassification: mountainsResults,
      youthClassification: youthResults,
      teamClassification: [],
      scrapedAt: new Date().toISOString(),
      source: 'SIMULATED',
      simulatedBy: userId,
    };

    // Save to Firestore
    const stageDocRef = db.collection(raceSlug).doc('stages').collection('results').doc(`stage-${stage}`);
    await stageDocRef.set(stageData);

    console.log(`[SIMULATE] Saved simulated stage result for ${raceSlug} stage ${stage}`);

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'STAGE_RESULT_SIMULATED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        raceSlug,
        stage,
        ridersCount: numRiders,
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    // Trigger points calculation
    console.log(`[SIMULATE] Triggering points calculation for ${raceSlug} stage ${stage}`);
    let pointsResult = null;
    try {
      const mockRequest = new NextRequest('http://localhost:3000/api/games/calculate-points', {
        method: 'POST',
        body: JSON.stringify({
          raceSlug,
          stage,
          year,
        }),
      });

      const calculatePointsResponse = await calculatePoints(mockRequest);
      pointsResult = await calculatePointsResponse.json();

      if (calculatePointsResponse.status === 200) {
        console.log('[SIMULATE] Points calculation completed:', pointsResult);
      } else {
        console.error('[SIMULATE] Failed to calculate points:', pointsResult);
      }
    } catch (error) {
      console.error('[SIMULATE] Error triggering points calculation:', error);
    }

    return NextResponse.json({
      success: true,
      message: `Stage ${stage} simulated successfully`,
      ridersGenerated: numRiders,
      gamesAffected: pointsResult?.results?.gamesProcessed || 0,
      stageData: {
        stageResults: stageResults.length,
        gc: gcResults.length,
        points: pointsResults.length,
        mountains: mountainsResults.length,
        youth: youthResults.length,
      },
    });

  } catch (error) {
    console.error('[SIMULATE] Error simulating stage result:', error);
    return NextResponse.json(
      { error: 'Failed to simulate stage result', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
