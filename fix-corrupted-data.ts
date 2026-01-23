// Script to fix the corrupted stageResults data in Firebase
import { getServerFirebase } from './lib/firebase/server';

async function fixTourDownUnderData() {
  try {
    const db = getServerFirebase();
    const doc = await db.collection('scraper-data').doc('tour-down-under-2026-prologue').get();
    
    if (!doc.exists) {
      console.log('Document not found');
      return;
    }
    
    const data = doc.data();
    console.log('Current data structure:');
    console.log('- stageResults type:', typeof data.stageResults);
    console.log('- generalClassification type:', typeof data.generalClassification);
    
    // Parse the stringified arrays
    let stageResults, generalClassification, pointsClassification, mountainsClassification, youthClassification;
    
    try {
      stageResults = typeof data.stageResults === 'string' ? JSON.parse(data.stageResults) : data.stageResults;
      generalClassification = typeof data.generalClassification === 'string' ? JSON.parse(data.generalClassification) : data.generalClassification;
      pointsClassification = typeof data.pointsClassification === 'string' ? JSON.parse(data.pointsClassification) : data.pointsClassification;
      mountainsClassification = typeof data.mountainsClassification === 'string' ? JSON.parse(data.mountainsClassification) : data.mountainsClassification;
      youthClassification = typeof data.youthClassification === 'string' ? JSON.parse(data.youthClassification) : data.youthClassification;
      
      console.log('Successfully parsed all arrays');
      console.log('- stageResults length:', stageResults.length);
      console.log('- generalClassification length:', generalClassification.length);
      
      // Check if Ethan Vernon is in the data
      const ethanVernon = stageResults.find(r => r.shortName === 'ethan-vernon');
      if (ethanVernon) {
        console.log('Found Ethan Vernon:', {
          shortName: ethanVernon.shortName,
          place: ethanVernon.place,
          points: ethanVernon.points
        });
      }
      
      // Update the document with properly parsed arrays
      await doc.ref.update({
        stageResults,
        generalClassification,
        pointsClassification,
        mountainsClassification,
        youthClassification,
        updatedAt: new Date().toISOString()
      });
      
      console.log('Successfully updated document with parsed arrays');
      
    } catch (parseError) {
      console.error('Error parsing arrays:', parseError);
    }
    
  } catch (error) {
    console.error('Error fixing data:', error);
  }
}

fixTourDownUnderData().catch(console.error);
