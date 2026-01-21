import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();
    
    console.log('Analyzing selection riders without bids...');
    
    // Get all selection riders
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('acquisitionType', '==', 'selection')
      .get();
    
    console.log(`Found ${playerTeamsSnapshot.size} selection riders`);
    
    // Get all won bids
    const bidsSnapshot = await db.collection('bids')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('status', '==', 'won')
      .get();
    
    console.log(`Found ${bidsSnapshot.size} won bids`);
    
    // Create a map of (userId, riderNameId) -> bid for quick lookup
    const bidsMap = new Map();
    bidsSnapshot.forEach(doc => {
      const bid = doc.data();
      const key = `${bid.userId}_${bid.riderNameId}`;
      bidsMap.set(key, bid);
    });
    
    // Find selection riders without bids
    const selectionWithoutBids = [];
    
    for (const doc of playerTeamsSnapshot.docs) {
      const playerTeam = doc.data();
      const riderNameId = playerTeam.riderNameId;
      const userId = playerTeam.userId;
      const key = `${userId}_${riderNameId}`;
      
      if (!bidsMap.has(key)) {
        selectionWithoutBids.push({
          riderNameId,
          riderName: playerTeam.riderName,
          userId,
          pricePaid: playerTeam.pricePaid,
          acquiredAt: playerTeam.acquiredAt,
          acquisitionType: playerTeam.acquisitionType
        });
      }
    }
    
    console.log(`Found ${selectionWithoutBids.length} selection riders without bids`);
    
    // Group by user to see which users have most selection riders
    const userSelections = new Map();
    selectionWithoutBids.forEach(item => {
      if (!userSelections.has(item.userId)) {
        userSelections.set(item.userId, []);
      }
      userSelections.get(item.userId).push(item);
    });
    
    // Sort users by number of selection riders
    const sortedUsers = Array.from(userSelections.entries())
      .map(([userId, riders]) => ({
        userId,
        count: riders.length,
        riders
      }))
      .sort((a, b) => b.count - a.count);
    
    // Get user names for the top users
    const userIds = sortedUsers.slice(0, 10).map(u => u.userId);
    const participantsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('userId', 'in', userIds)
      .get();
    
    const participantsMap = new Map();
    participantsSnapshot.forEach(doc => {
      const data = doc.data();
      participantsMap.set(data.userId, data.playername);
    });
    
    const topUsers = sortedUsers.slice(0, 10).map(user => ({
      userId: user.userId,
      playername: participantsMap.get(user.userId) || 'Unknown',
      count: user.count,
      riders: user.riders.slice(0, 3).map(r => ({
        name: r.riderName,
        pricePaid: r.pricePaid,
        acquiredAt: r.acquiredAt
      }))
    }));
    
    // Check acquisition dates to see if they're all the same
    const acquisitionDates = selectionWithoutBids.map(item => item.acquiredAt);
    const uniqueDates = [...new Set(acquisitionDates)];
    
    return NextResponse.json({
      success: true,
      analysis: {
        totalSelectionRiders: playerTeamsSnapshot.size,
        selectionWithoutBids: selectionWithoutBids.length,
        percentageWithoutBids: ((selectionWithoutBids.length / playerTeamsSnapshot.size) * 100).toFixed(1),
        uniqueAcquisitionDates: uniqueDates.length,
        topUsers,
        sampleRiders: selectionWithoutBids.slice(0, 10)
      }
    });
    
  } catch (error) {
    console.error('Error analyzing selection riders:', error);
    return NextResponse.json(
      { error: 'Failed to analyze selection riders', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
