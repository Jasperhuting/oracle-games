import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * GET: Check all participants in a game for discrepancies between gameParticipants.team[] and playerTeams
 */
export async function GET(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const adminUserId = searchParams.get('adminUserId');

    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
    }

    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();

    // Get all participants in this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    interface Discrepancy {
      userId: string;
      playername: string;
      teamSize: number;
      playerTeamsCount: number;
      missingCount: number;
      extraCount: number;
      missingRiders: string[];
      extraRiders: string[];
    }

    const discrepancies: Discrepancy[] = [];
    const results: string[] = [];

    results.push(`Checking ${participantsSnapshot.size} participants in game: ${gameData?.name}`);
    results.push('');

    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = participantDoc.data();
      const teamArray = participantData.team || [];
      const teamRiderIds = new Set(teamArray.map((r: { riderNameId: string }) => r.riderNameId));

      // Get playerTeams for this user
      const playerTeamsSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      const playerTeamsRiderIds = new Set(
        playerTeamsSnapshot.docs.map(doc => doc.data().riderNameId)
      );

      // Find missing (in team[] but not in playerTeams)
      const missingRiders: string[] = [];
      for (const rider of teamArray) {
        if (!playerTeamsRiderIds.has(rider.riderNameId)) {
          missingRiders.push(rider.riderName);
        }
      }

      // Find extra (in playerTeams but not in team[])
      const extraRiders: string[] = [];
      for (const doc of playerTeamsSnapshot.docs) {
        const riderData = doc.data();
        if (!teamRiderIds.has(riderData.riderNameId)) {
          extraRiders.push(riderData.riderName);
        }
      }

      if (missingRiders.length > 0 || extraRiders.length > 0) {
        discrepancies.push({
          userId: participantData.userId,
          playername: participantData.playername,
          teamSize: teamArray.length,
          playerTeamsCount: playerTeamsSnapshot.size,
          missingCount: missingRiders.length,
          extraCount: extraRiders.length,
          missingRiders,
          extraRiders,
        });

        results.push(`❌ ${participantData.playername} (${participantData.userId})`);
        results.push(`   Team: ${teamArray.length}, PlayerTeams: ${playerTeamsSnapshot.size}`);
        if (missingRiders.length > 0) {
          results.push(`   Missing: ${missingRiders.join(', ')}`);
        }
        if (extraRiders.length > 0) {
          results.push(`   Extra: ${extraRiders.join(', ')}`);
        }
        results.push('');
      }
    }

    if (discrepancies.length === 0) {
      results.push('✓ All participants are in sync!');
    } else {
      results.push(`Found ${discrepancies.length} participants with discrepancies.`);
    }

    return NextResponse.json({
      success: true,
      game: gameData?.name,
      totalParticipants: participantsSnapshot.size,
      discrepanciesFound: discrepancies.length,
      discrepancies,
      results: results.join('\n'),
    });
  } catch (error) {
    console.error('Error checking discrepancies:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST: Sync gameParticipants.team[] to playerTeams for a specific user
 *
 * This is useful when gameParticipants.team[] has riders but playerTeams is missing entries.
 * It copies points from existing playerTeams entries for the same rider (from other users/games).
 */
export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const body = await request.json();
    const { gameId, userId, adminUserId, dryRun = true } = body;

    // Verify admin
    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
    }

    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!gameId || !userId) {
      return NextResponse.json(
        { error: 'gameId and userId are required' },
        { status: 400 }
      );
    }

    const results: string[] = [];

    results.push(`${dryRun ? '[DRY RUN] ' : ''}Syncing gameParticipants.team[] to playerTeams for user ${userId} in game ${gameId}...`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    results.push(`Game: ${gameData?.name}`);

    // Get participant data
    const participantSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (participantSnapshot.empty) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      );
    }

    const participantDoc = participantSnapshot.docs[0];
    const participantData = participantDoc.data();
    const teamArray = participantData.team || [];

    results.push(`Participant: ${participantData.playername}`);
    results.push(`Team size in gameParticipants.team[]: ${teamArray.length}`);

    // Get existing playerTeams for this user in this game
    const existingPlayerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', gameId)
      .where('userId', '==', userId)
      .get();

    const existingRiderIds = new Set(
      existingPlayerTeamsSnapshot.docs.map(doc => doc.data().riderNameId)
    );

    results.push(`Existing playerTeams count: ${existingPlayerTeamsSnapshot.size}`);

    // Find riders in team[] that don't have a playerTeam entry
    interface MissingRider {
      riderNameId: string;
      riderName: string;
      pricePaid: number;
      acquiredAt: FirebaseFirestore.Timestamp;
      riderTeam: string;
      jerseyImage: string;
    }

    const missingRiders: MissingRider[] = [];
    const alreadyExist: string[] = [];

    for (const rider of teamArray) {
      if (existingRiderIds.has(rider.riderNameId)) {
        alreadyExist.push(rider.riderName);
      } else {
        missingRiders.push({
          riderNameId: rider.riderNameId,
          riderName: rider.riderName,
          pricePaid: rider.pricePaid,
          acquiredAt: rider.acquiredAt,
          riderTeam: rider.riderTeam || '',
          jerseyImage: rider.jerseyImage || '',
        });
      }
    }

    results.push(`\n--- Analysis ---`);
    results.push(`Riders with existing playerTeam: ${alreadyExist.length}`);
    results.push(`Riders MISSING playerTeam: ${missingRiders.length}`);

    if (missingRiders.length === 0) {
      results.push(`\n✓ All riders already have playerTeams entries!`);
      return NextResponse.json({
        success: true,
        dryRun,
        results: results.join('\n'),
        summary: {
          teamSize: teamArray.length,
          existingPlayerTeams: existingPlayerTeamsSnapshot.size,
          missingRiders: 0,
        },
      });
    }

    // For each missing rider, find an existing playerTeam to copy points from
    interface RiderToCreate {
      riderNameId: string;
      riderName: string;
      pricePaid: number;
      acquiredAt: FirebaseFirestore.Timestamp;
      riderTeam: string;
      jerseyImage: string;
      totalPoints: number;
      pointsScored: number;
      stagesParticipated: number;
      pointsBreakdown: Array<Record<string, unknown>>;
      racePoints: Record<string, unknown>;
      sourcePlayerTeamId?: string;
    }

    const ridersToCreate: RiderToCreate[] = [];

    results.push(`\nMissing riders (will copy points from existing entries):`);

    for (const rider of missingRiders) {
      // Find an existing playerTeam for this rider (same game, different user preferred)
      const existingRiderTeamSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('riderNameId', '==', rider.riderNameId)
        .limit(1)
        .get();

      let sourcePlayerTeam: FirebaseFirestore.DocumentData | null = null;
      let sourceId = '';

      if (!existingRiderTeamSnapshot.empty) {
        sourcePlayerTeam = existingRiderTeamSnapshot.docs[0].data();
        sourceId = existingRiderTeamSnapshot.docs[0].id;
      }

      const riderData: RiderToCreate = {
        ...rider,
        totalPoints: sourcePlayerTeam?.totalPoints || 0,
        pointsScored: sourcePlayerTeam?.pointsScored || 0,
        stagesParticipated: sourcePlayerTeam?.stagesParticipated || 0,
        pointsBreakdown: sourcePlayerTeam?.pointsBreakdown || [],
        racePoints: sourcePlayerTeam?.racePoints || {},
        sourcePlayerTeamId: sourceId || undefined,
      };

      ridersToCreate.push(riderData);

      const pointsInfo = sourcePlayerTeam
        ? `${riderData.totalPoints} pts (from ${sourceId})`
        : '0 pts (no source found)';
      results.push(`  - ${rider.riderName} (€${rider.pricePaid}) -> ${pointsInfo}`);
    }

    if (dryRun) {
      results.push(`\n[DRY RUN] No changes made. Set dryRun: false to apply changes.`);

      return NextResponse.json({
        success: true,
        dryRun: true,
        results: results.join('\n'),
        summary: {
          teamSize: teamArray.length,
          existingPlayerTeams: existingPlayerTeamsSnapshot.size,
          missingRiders: missingRiders.length,
          ridersToCreate: ridersToCreate.map(r => ({
            riderName: r.riderName,
            riderNameId: r.riderNameId,
            pricePaid: r.pricePaid,
            totalPoints: r.totalPoints,
            sourcePlayerTeamId: r.sourcePlayerTeamId,
          })),
        },
      });
    }

    // Execute changes
    results.push(`\n--- Creating missing playerTeams ---`);

    for (const rider of ridersToCreate) {
      await db.collection('playerTeams').add({
        gameId: gameId,
        userId: userId,
        riderNameId: rider.riderNameId,
        acquiredAt: rider.acquiredAt || Timestamp.now(),
        acquisitionType: 'selection',
        pricePaid: rider.pricePaid,
        riderName: rider.riderName,
        riderTeam: rider.riderTeam,
        riderCountry: '',
        jerseyImage: rider.jerseyImage,
        // Points copied from source
        pointsScored: rider.pointsScored,
        stagesParticipated: rider.stagesParticipated,
        totalPoints: rider.totalPoints,
        pointsBreakdown: rider.pointsBreakdown,
        racePoints: rider.racePoints,
      });
      results.push(`✓ Created PlayerTeam for ${rider.riderName} (${rider.totalPoints} pts)`);
    }

    // Log the activity
    await db.collection('activityLogs').add({
      action: 'ADMIN_SYNC_TEAM_TO_PLAYERTEAMS',
      userId: adminUserId,
      details: {
        gameId,
        targetUserId: userId,
        playername: participantData.playername,
        playerTeamsCreated: ridersToCreate.length,
        riders: ridersToCreate.map(r => ({
          riderName: r.riderName,
          totalPoints: r.totalPoints,
          sourcePlayerTeamId: r.sourcePlayerTeamId,
        })),
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    results.push('\n✓ Sync completed successfully!');

    return NextResponse.json({
      success: true,
      dryRun: false,
      results: results.join('\n'),
      summary: {
        playerTeamsCreated: ridersToCreate.length,
        totalPointsAdded: ridersToCreate.reduce((sum, r) => sum + r.totalPoints, 0),
      },
    });
  } catch (error) {
    console.error('Error syncing team to playerTeams:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PUT: Fix ALL discrepancies for all participants in a game
 *
 * This will:
 * 1. Add missing playerTeams entries (copying points from existing entries)
 * 2. Delete extra playerTeams entries that are not in gameParticipants.team[]
 */
export async function PUT(request: NextRequest) {
  try {
    const db = getServerFirebase();

    const body = await request.json();
    const { gameId, adminUserId, dryRun = true } = body;

    // Verify admin
    if (!adminUserId) {
      return NextResponse.json({ error: 'adminUserId is required' }, { status: 400 });
    }

    const adminUserDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminUserDoc.exists || adminUserDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    if (!gameId) {
      return NextResponse.json({ error: 'gameId is required' }, { status: 400 });
    }

    const results: string[] = [];
    results.push(`${dryRun ? '[DRY RUN] ' : ''}Fixing all discrepancies for game ${gameId}...`);

    // Get game data
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameData = gameDoc.data();
    results.push(`Game: ${gameData?.name}\n`);

    // Get all participants in this game
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', gameId)
      .get();

    let totalCreated = 0;
    let totalDeleted = 0;
    let totalPointsAdded = 0;
    let participantsFixed = 0;

    for (const participantDoc of participantsSnapshot.docs) {
      const participantData = participantDoc.data();
      const teamArray = participantData.team || [];
      const teamRiderIds = new Set(teamArray.map((r: { riderNameId: string }) => r.riderNameId));

      // Get playerTeams for this user
      const playerTeamsSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', gameId)
        .where('userId', '==', participantData.userId)
        .get();

      const playerTeamsMap = new Map<string, { id: string; data: FirebaseFirestore.DocumentData }>();
      for (const doc of playerTeamsSnapshot.docs) {
        playerTeamsMap.set(doc.data().riderNameId, { id: doc.id, data: doc.data() });
      }

      // Find missing riders (in team[] but not in playerTeams)
      const missingRiders: Array<{
        riderNameId: string;
        riderName: string;
        pricePaid: number;
        acquiredAt: FirebaseFirestore.Timestamp;
        riderTeam: string;
        jerseyImage: string;
      }> = [];

      for (const rider of teamArray) {
        if (!playerTeamsMap.has(rider.riderNameId)) {
          missingRiders.push({
            riderNameId: rider.riderNameId,
            riderName: rider.riderName,
            pricePaid: rider.pricePaid,
            acquiredAt: rider.acquiredAt,
            riderTeam: rider.riderTeam || '',
            jerseyImage: rider.jerseyImage || '',
          });
        }
      }

      // Find extra playerTeams (in playerTeams but not in team[])
      const extraPlayerTeams: Array<{ id: string; riderName: string }> = [];
      for (const doc of playerTeamsSnapshot.docs) {
        const riderData = doc.data();
        if (!teamRiderIds.has(riderData.riderNameId)) {
          extraPlayerTeams.push({ id: doc.id, riderName: riderData.riderName });
        }
      }

      if (missingRiders.length === 0 && extraPlayerTeams.length === 0) {
        continue; // No discrepancies for this participant
      }

      participantsFixed++;
      results.push(`--- ${participantData.playername} ---`);

      // Create missing playerTeams
      if (missingRiders.length > 0) {
        results.push(`  Adding ${missingRiders.length} missing riders:`);

        for (const rider of missingRiders) {
          // Find source for points
          const existingRiderTeamSnapshot = await db.collection('playerTeams')
            .where('gameId', '==', gameId)
            .where('riderNameId', '==', rider.riderNameId)
            .limit(1)
            .get();

          let totalPoints = 0;
          let pointsScored = 0;
          let stagesParticipated = 0;
          let pointsBreakdown: Array<Record<string, unknown>> = [];
          let racePoints: Record<string, unknown> = {};

          if (!existingRiderTeamSnapshot.empty) {
            const source = existingRiderTeamSnapshot.docs[0].data();
            totalPoints = source.totalPoints || 0;
            pointsScored = source.pointsScored || 0;
            stagesParticipated = source.stagesParticipated || 0;
            pointsBreakdown = source.pointsBreakdown || [];
            racePoints = source.racePoints || {};
          }

          if (!dryRun) {
            await db.collection('playerTeams').add({
              gameId: gameId,
              userId: participantData.userId,
              riderNameId: rider.riderNameId,
              acquiredAt: rider.acquiredAt || Timestamp.now(),
              acquisitionType: 'selection',
              pricePaid: rider.pricePaid,
              riderName: rider.riderName,
              riderTeam: rider.riderTeam,
              riderCountry: '',
              jerseyImage: rider.jerseyImage,
              pointsScored,
              stagesParticipated,
              totalPoints,
              pointsBreakdown,
              racePoints,
            });
          }

          results.push(`    + ${rider.riderName} (${totalPoints} pts)`);
          totalCreated++;
          totalPointsAdded += totalPoints;
        }
      }

      // Delete extra playerTeams
      if (extraPlayerTeams.length > 0) {
        results.push(`  Removing ${extraPlayerTeams.length} extra riders:`);

        for (const extra of extraPlayerTeams) {
          if (!dryRun) {
            await db.collection('playerTeams').doc(extra.id).delete();
          }
          results.push(`    - ${extra.riderName}`);
          totalDeleted++;
        }
      }

      results.push('');
    }

    if (!dryRun) {
      // Log the activity
      await db.collection('activityLogs').add({
        action: 'ADMIN_FIX_ALL_DISCREPANCIES',
        userId: adminUserId,
        details: {
          gameId,
          participantsFixed,
          playerTeamsCreated: totalCreated,
          playerTeamsDeleted: totalDeleted,
          totalPointsAdded,
        },
        timestamp: Timestamp.now(),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      });
    }

    results.push(`=== Summary ===`);
    results.push(`Participants fixed: ${participantsFixed}`);
    results.push(`PlayerTeams created: ${totalCreated}`);
    results.push(`PlayerTeams deleted: ${totalDeleted}`);
    results.push(`Total points added: ${totalPointsAdded}`);

    if (dryRun) {
      results.push(`\n[DRY RUN] No changes made. Set dryRun: false to apply changes.`);
    } else {
      results.push(`\n✓ All discrepancies fixed!`);
    }

    return NextResponse.json({
      success: true,
      dryRun,
      results: results.join('\n'),
      summary: {
        participantsFixed,
        playerTeamsCreated: totalCreated,
        playerTeamsDeleted: totalDeleted,
        totalPointsAdded,
      },
    });
  } catch (error) {
    console.error('Error fixing discrepancies:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
