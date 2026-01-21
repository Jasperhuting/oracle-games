import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();
    
    console.log('Generating team size correction report...');
    
    // Get all teams with their riders
    const teamsSnapshot = await db.collection('gameParticipants')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .get();
    
    console.log(`Found ${teamsSnapshot.size} teams to analyze`);
    
    const potentialRemovals = [];
    let totalPotentialRemovals = 0;
    
    for (const teamDoc of teamsSnapshot.docs) {
      const team = teamDoc.data();
      const userId = team.userId;
      
      // Get all riders for this team
      const ridersSnapshot = await db.collection('playerTeams')
        .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
        .where('userId', '==', userId)
        .get();
      
      if (ridersSnapshot.size <= 32) {
        continue; // Team is already within limit
      }
      
      console.log(`Team ${team.playername} has ${ridersSnapshot.size} riders (would remove: ${ridersSnapshot.size - 32})`);
      
      // Get all bids for this user to find bid dates
      const bidsSnapshot = await db.collection('bids')
        .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
        .where('userId', '==', userId)
        .where('status', '==', 'won')
        .get();
      
      // Create map of riderNameId -> bid info
      const bidsMap = new Map();
      bidsSnapshot.forEach(doc => {
        const bid = doc.data();
        bidsMap.set(bid.riderNameId, {
          bidAt: bid.bidAt,
          amount: bid.amount,
          bidId: doc.id
        });
      });
      
      // Sort riders by acquisition date (newest first)
      const riders = ridersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          riderNameId: data.riderNameId,
          riderName: data.riderName,
          acquiredAt: data.acquiredAt,
          pricePaid: data.pricePaid,
          bidInfo: bidsMap.get(data.riderNameId) || null
        };
      });
      
      // Sort by acquiredAt (newest first), then by bidAt if available
      riders.sort((a, b) => {
        const dateA = a.bidInfo?.bidAt || a.acquiredAt;
        const dateB = b.bidInfo?.bidAt || b.acquiredAt;
        
        // Handle Firestore timestamps
        const timeA = typeof dateA === 'object' && dateA._seconds ? 
          dateA._seconds * 1000 + (dateA._nanoseconds || 0) / 1000000 :
          dateA;
        const timeB = typeof dateB === 'object' && dateB._seconds ? 
          dateB._seconds * 1000 + (dateB._nanoseconds || 0) / 1000000 :
          dateB;
        
        return timeB - timeA; // Newest first
      });
      
      // Identify riders that would be removed (keep first 32)
      const toRemove = riders.slice(32);
      
      if (toRemove.length > 0) {
        console.log(`Would remove ${toRemove.length} riders from ${team.playername}`);
        
        // Record potential removals for report
        for (const rider of toRemove) {
          let bidDate = 'Selection (no bid)';
          let bidAmount = rider.pricePaid;
          
          if (rider.bidInfo) {
            if (typeof rider.bidInfo.bidAt === 'object' && rider.bidInfo.bidAt._seconds) {
              const date = new Date(rider.bidInfo.bidAt._seconds * 1000 + (rider.bidInfo.bidAt._nanoseconds || 0) / 1000000);
              bidDate = date.toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            } else if (rider.bidInfo.bidAt.toDate) {
              bidDate = rider.bidInfo.bidAt.toDate().toLocaleDateString('nl-NL', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              });
            }
            bidAmount = rider.bidInfo.amount;
          } else if (typeof rider.acquiredAt === 'object' && rider.acquiredAt._seconds) {
            const date = new Date(rider.acquiredAt._seconds * 1000 + (rider.acquiredAt._nanoseconds || 0) / 1000000);
            bidDate = date.toLocaleDateString('nl-NL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });
          }
          
          potentialRemovals.push({
            teamName: team.playername,
            userId: userId,
            riderName: rider.riderName,
            riderNameId: rider.riderNameId,
            bidDate: bidDate,
            bidAmount: bidAmount,
            acquisitionType: rider.bidInfo ? 'auction' : 'selection',
            wouldBeRemoved: true
          });
        }
        
        totalPotentialRemovals += toRemove.length;
      }
    }
    
    console.log(`Generated report for ${totalPotentialRemovals} potential removals`);
    
    return NextResponse.json({
      success: true,
      summary: {
        teamsChecked: teamsSnapshot.size,
        teamsWithOversize: potentialRemovals.length > 0 ? new Set(potentialRemovals.map(r => r.teamName)).size : 0,
        totalPotentialRemovals
      },
      potentialRemovals
    });
    
  } catch (error) {
    console.error('Error generating correction report:', error);
    return NextResponse.json(
      { error: 'Failed to generate correction report', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
