// Script to analyze bid inconsistencies
const admin = require('firebase-admin');
const serviceAccount = require('../../../path/to/serviceAccountKey.json'); // Update path

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function analyzeBidInconsistencies() {
  try {
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
    
    console.log(`\nFound ${duplicates.length} riders with multiple won bids:`);
    
    duplicates.forEach(({ riderNameId, bids }) => {
      console.log(`\n🚨 ${riderNameId}:`);
      bids.forEach(bid => {
        console.log(`  - ${bid.playername} (${bid.userId}): ${bid.amount}M on ${bid.bidAt}`);
      });
    });
    
    // Check for selection riders without bids
    console.log('\n\nChecking for selection riders without bids...');
    
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
    
    console.log(`\nFound ${selectionWithoutBids.length} selection riders without bids:`);
    
    selectionWithoutBids.forEach(item => {
      console.log(`  - ${item.riderName} (${item.riderNameId}): ${item.pricePaid}M, acquired: ${item.acquiredAt}`);
    });
    
    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total won bids: ${bidsSnapshot.size}`);
    console.log(`Riders with multiple won bids: ${duplicates.length}`);
    console.log(`Selection riders without bids: ${selectionWithoutBids.length}`);
    
    if (duplicates.length > 0 || selectionWithoutBids.length > 0) {
      console.log('\n⚠️  DATA INCONSISTENCIES DETECTED!');
    } else {
      console.log('\n✅ No inconsistencies found');
    }
    
  } catch (error) {
    console.error('Error analyzing bids:', error);
  } finally {
    // Close Firebase connection
    admin.app().delete();
  }
}

// Run the analysis
analyzeBidInconsistencies();
