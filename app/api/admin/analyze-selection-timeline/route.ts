import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();
    
    console.log('Analyzing acquisition timeline for selection riders...');
    
    // Get all selection riders
    const playerTeamsSnapshot = await db.collection('playerTeams')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('acquisitionType', '==', 'selection')
      .get();
    
    // Get all won bids
    const bidsSnapshot = await db.collection('bids')
      .where('gameId', '==', 'mGzPZfIOb2gAyEu0i6t6')
      .where('status', '==', 'won')
      .get();
    
    // Create a map of (userId, riderNameId) -> bid for quick lookup
    const bidsMap = new Map();
    bidsSnapshot.forEach(doc => {
      const bid = doc.data();
      const key = `${bid.userId}_${bid.riderNameId}`;
      bidsMap.set(key, bid);
    });
    
    // Find selection riders without bids and group by acquisition date
    const selectionWithoutBids = [];
    const dateGroups = new Map();
    
    for (const doc of playerTeamsSnapshot.docs) {
      const playerTeam = doc.data();
      const riderNameId = playerTeam.riderNameId;
      const userId = playerTeam.userId;
      const key = `${userId}_${riderNameId}`;
      
      if (!bidsMap.has(key)) {
        const acquiredAt = playerTeam.acquiredAt;
        let dateStr;
        
        // Convert Firestore Timestamp to readable format
        if (typeof acquiredAt === 'object' && acquiredAt._seconds) {
          const date = new Date(acquiredAt._seconds * 1000 + (acquiredAt._nanoseconds || 0) / 1000000);
          dateStr = date.toISOString();
        } else if (acquiredAt.toDate) {
          dateStr = acquiredAt.toDate().toISOString();
        } else {
          dateStr = acquiredAt;
        }
        
        const dateOnly = dateStr.split('T')[0]; // Extract just the date part
        
        if (!dateGroups.has(dateOnly)) {
          dateGroups.set(dateOnly, []);
        }
        
        const riderInfo = {
          riderNameId,
          riderName: playerTeam.riderName,
          userId,
          pricePaid: playerTeam.pricePaid,
          acquiredAt: dateStr,
          dateOnly: dateOnly
        };
        
        dateGroups.get(dateOnly).push(riderInfo);
        selectionWithoutBids.push(riderInfo);
      }
    }
    
    // Sort dates chronologically
    const sortedDates = Array.from(dateGroups.entries())
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    // Create timeline data
    const timeline = sortedDates.map(([date, riders]) => ({
      date,
      count: riders.length,
      riders: riders.slice(0, 5), // Show first 5 riders as sample
      totalValue: riders.reduce((sum, r) => sum + (r.pricePaid || 0), 0)
    }));
    
    // Find the earliest and latest dates
    const earliestDate = sortedDates[0]?.[0] || null;
    const latestDate = sortedDates[sortedDates.length - 1]?.[0] || null;
    
    // Check if this matches the auction finalization date
    const gameDoc = await db.collection('games').doc('mGzPZfIOb2gAyEu0i6t6').get();
    const gameData = gameDoc.data();
    const finalizedAt = gameData?.finalizedAt;
    
    let finalizedDate = null;
    if (finalizedAt) {
      if (typeof finalizedAt === 'object' && finalizedAt._seconds) {
        finalizedDate = new Date(finalizedAt._seconds * 1000 + (finalizedAt._nanoseconds || 0) / 1000000).toISOString().split('T')[0];
      } else if (finalizedAt.toDate) {
        finalizedDate = finalizedAt.toDate().toISOString().split('T')[0];
      }
    }
    
    // Analyze patterns
    const peakDay = timeline.reduce((max, day) => day.count > max.count ? day : max, timeline[0] || { count: 0 });
    const totalValue = timeline.reduce((sum, day) => sum + day.totalValue, 0);
    
    return NextResponse.json({
      success: true,
      analysis: {
        totalSelectionRiders: playerTeamsSnapshot.size,
        selectionWithoutBids: selectionWithoutBids.length,
        dateRange: {
          earliest: earliestDate,
          latest: latestDate,
          spanInDays: earliestDate && latestDate ? 
            Math.ceil((new Date(latestDate).getTime() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24)) : 0
        },
        finalizedDate,
        peakDay: {
          date: peakDay.date,
          count: peakDay.count
        },
        totalValue,
        averageValuePerRider: selectionWithoutBids.length > 0 ? Math.round(totalValue / selectionWithoutBids.length) : 0,
        timeline
      }
    });
    
  } catch (error) {
    console.error('Error analyzing acquisition timeline:', error);
    return NextResponse.json(
      { error: 'Failed to analyze acquisition timeline', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
