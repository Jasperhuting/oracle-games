import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const db = getServerFirebase();
    
    console.log('Starting to remove active and benched fields from PlayerTeam documents...');
    
    // Get all PlayerTeam documents
    const snapshot = await db.collection('playerTeams').get();
    
    console.log(`Found ${snapshot.size} PlayerTeam documents to update`);
    
    let batch = db.batch();
    let batchCount = 0;
    let totalUpdated = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      
      // Check if document has active or benched fields
      if (data.hasOwnProperty('active') || data.hasOwnProperty('benched')) {
        // Remove the fields from the document
        batch.update(doc.ref, {
          active: FieldValue.delete(),
          benched: FieldValue.delete()
        });
        
        batchCount++;
        totalUpdated++;
        
        // Execute batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`Updated batch of ${batchCount} documents. Total updated: ${totalUpdated}`);
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    
    // Commit remaining operations
    if (batchCount > 0) {
      await batch.commit();
      console.log(`Updated final batch of ${batchCount} documents. Total updated: ${totalUpdated}`);
    }
    
    console.log(`Successfully removed active and benched fields from ${totalUpdated} PlayerTeam documents`);
    
    return NextResponse.json({
      success: true,
      message: `Successfully removed active and benched fields from ${totalUpdated} PlayerTeam documents`,
      totalUpdated
    });
    
  } catch (error) {
    console.error('Error removing fields:', error);
    return NextResponse.json(
      { error: 'Failed to remove fields', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
