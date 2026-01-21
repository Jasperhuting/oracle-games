import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();
    
    console.log('Starting bid inconsistency analysis...');
    
    // Get all won bids
    const bidsSnapshot = await db.collection('bids')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('status', '==', 'won')
      .get();
    
    console.log(`Found ${bidsSnapshot.size} won bids`);
    
    // Group by riderNameId to find duplicates
    const riderBidsMap = new Map();
    
    bidsSnapshot.forEach(doc => {
      const bid = doc.data();
      const riderNameId = bid.riderNameId;
      
      if (!riderBidsMap.has(riderNameId)) {
        riderBidsMap.set(riderNameId, []);
      }
      
      riderBidsMap.get(riderNameId).push({
        id: doc.id,
        userId: bid.userId,
        playername: bid.playername,
        amount: bid.amount,
        bidAt: bid.bidAt
      });
    });
    
    // Find riders with multiple won bids
    const duplicates = [];
    riderBidsMap.forEach((bids, riderNameId) => {
      if (bids.length > 1) {
        duplicates.push({
          riderNameId,
          bids
        });
      }
    });
    
    console.log(`Found ${duplicates.length} riders with multiple won bids`);
    
    // Check for selection riders without bids
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('acquisitionType', '==', 'selection')
      .get();
    
    console.log(`Found ${playerTeamsSnapshot.size} selection riders`);
    
    const selectionWithoutBids = [];
    
    for (const doc of playerTeamsSnapshot.docs) {
      const playerTeam = doc.data();
      const riderNameId = playerTeam.riderNameId;
      const userId = playerTeam.userId;
      
      // Check if there's a bid for this rider and user
      const bidExists = bidsSnapshot.docs.some(bidDoc => {
        const bid = bidDoc.data();
        return bid.riderNameId === riderNameId && bid.userId === userId;
      });
      
      if (!bidExists) {
        selectionWithoutBids.push({
          riderNameId,
          riderName: playerTeam.riderName,
          userId,
          pricePaid: playerTeam.pricePaid,
          acquiredAt: playerTeam.acquiredAt
        });
      }
    }
    
    console.log(`Found ${selectionWithoutBids.length} selection riders without bids`);
    
    return NextResponse.json({
      success: true,
      analysis: {
        totalWonBids: bidsSnapshot.size,
        duplicateWinners: duplicates.length,
        selectionWithoutBids: selectionWithoutBids.length,
        duplicates: duplicates,
        selectionWithoutBids: selectionWithoutBids
      }
    });
    
  } catch (error) {
    console.error('Error analyzing bids:', error);
    return NextResponse.json(
      { error: 'Failed to analyze bids', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
