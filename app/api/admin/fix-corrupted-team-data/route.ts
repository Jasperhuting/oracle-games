import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';
import { fixCorruptedTeamData } from '@/scripts/fix-corrupted-team-data';

/**
 * Admin-only endpoint to fix corrupted team data in gameParticipants
 * Reconstructs team arrays from playerTeams collection
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const db = getServerFirebase();

    // Verify the requesting user is an admin
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists || userDoc.data()?.userType !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    console.log('[FIX_CORRUPTED_TEAMS_API] Starting team data fix...');

    // 1. Find all participants with corrupted team data
    const allParticipantsSnapshot = await db.collection('gameParticipants').get();
    
    const corruptedParticipants: Array<{
      id: string;
      gameId: string;
      userId: string;
      playername: string;
      team: string;
    }> = [];
    
    allParticipantsSnapshot.forEach(doc => {
      const data = doc.data();
      const team = data.team;
      
      // Check if team is corrupted (contains "[object Object]" pattern)
      if (typeof team === 'string' && team.includes('[object Object]')) {
        corruptedParticipants.push({
          id: doc.id,
          gameId: data.gameId,
          userId: data.userId,
          playername: data.playername,
          team: team
        });
      }
    });
    
    console.log(`[FIX_CORRUPTED_TEAMS_API] Found ${corruptedParticipants.length} participants with corrupted team data`);
    
    if (corruptedParticipants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No corrupted data found. All good!',
        fixedCount: 0,
        errorCount: 0,
        corruptedParticipants: []
      });
    }
    
    // 2. For each corrupted participant, reconstruct team from playerTeams
    let fixedCount = 0;
    let errorCount = 0;
    const fixedDetails: Array<{
      participantId: string;
      playername: string;
      gameId: string;
      ridersReconstructed: number;
    }> = [];
    
    for (const participant of corruptedParticipants) {
      try {
        console.log(`[FIX_CORRUPTED_TEAMS_API] Fixing participant: ${participant.playername} (${participant.userId})`);
        
        // Get playerTeams for this participant
        const playerTeamsSnapshot = await db.collection('playerTeams')
          .where('gameId', '==', participant.gameId)
          .where('userId', '==', participant.userId)
          .where('active', '==', true)
          .get();
        
        if (playerTeamsSnapshot.empty) {
          console.log(`[FIX_CORRUPTED_TEAMS_API] No playerTeams found for ${participant.playername}, setting team to empty array`);
          await db.collection('gameParticipants').doc(participant.id).update({
            team: []
          });
          fixedCount++;
          fixedDetails.push({
            participantId: participant.id,
            playername: participant.playername,
            gameId: participant.gameId,
            ridersReconstructed: 0
          });
          continue;
        }
        
        // Reconstruct team array from playerTeams
        const reconstructedTeam = playerTeamsSnapshot.docs.map(doc => {
          const teamData = doc.data();
          return {
            riderNameId: teamData.riderNameId,
            riderName: teamData.riderName,
            riderTeam: teamData.riderTeam,
            riderCountry: teamData.riderCountry,
            jerseyImage: teamData.jerseyImage,
            acquiredAt: teamData.acquiredAt?.toDate?.()?.toISOString() || teamData.acquiredAt,
            amount: teamData.pricePaid || 0,
            acquisitionType: teamData.acquisitionType || 'auction',
            active: teamData.active,
            benched: teamData.benched,
            pointsScored: teamData.pointsScored || 0,
            stagesParticipated: teamData.stagesParticipated || 0
          };
        });
        
        console.log(`[FIX_CORRUPTED_TEAMS_API] Reconstructed team with ${reconstructedTeam.length} riders for ${participant.playername}`);
        
        // Update the participant with correct team data
        await db.collection('gameParticipants').doc(participant.id).update({
          team: reconstructedTeam
        });
        
        fixedCount++;
        fixedDetails.push({
          participantId: participant.id,
          playername: participant.playername,
          gameId: participant.gameId,
          ridersReconstructed: reconstructedTeam.length
        });
        
      } catch (error) {
        console.error(`[FIX_CORRUPTED_TEAMS_API] Error fixing participant ${participant.playername}:`, error);
        errorCount++;
      }
    }
    
    console.log(`[FIX_CORRUPTED_TEAMS_API] Fix complete: ${fixedCount} fixed, ${errorCount} errors`);
    
    // Log the activity
    const userData = userDoc.data();
    await db.collection('activityLogs').add({
      action: 'CORRUPTED_TEAM_DATA_FIXED',
      userId: userId,
      userEmail: userData?.email,
      userName: userData?.playername || userData?.email,
      details: {
        totalCorrupted: corruptedParticipants.length,
        fixedCount,
        errorCount,
        fixedDetails
      },
      timestamp: Timestamp.now(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} participants with corrupted team data`,
      totalCorrupted: corruptedParticipants.length,
      fixedCount,
      errorCount,
      fixedDetails,
      corruptedParticipants: corruptedParticipants.map(p => ({
        id: p.id,
        playername: p.playername,
        gameId: p.gameId,
        userId: p.userId
      }))
    });

  } catch (error) {
    console.error('[FIX_CORRUPTED_TEAMS_API] Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to fix corrupted team data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
