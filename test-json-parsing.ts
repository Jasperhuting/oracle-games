// Test script to verify JSON parsing works
import { getServerFirebase } from './lib/firebase/server';

async function testJsonParsing() {
  try {
    const db = getServerFirebase();
    const doc = await db.collection('scraper-data').doc('tour-down-under-2026-prologue').get();
    
    if (!doc.exists) {
      console.log('Document not found');
      return;
    }
    
    const data = doc.data();
    console.log('Raw stageResults type:', typeof data.stageResults);
    
    // Test the parsing logic from calculate-points
    const stageResults = data.stageResults ? 
      (typeof data.stageResults === 'string' ? JSON.parse(data.stageResults) : data.stageResults) : [];
    
    console.log('Parsed stageResults length:', stageResults.length);
    console.log('First rider:', stageResults[0]);
    
    // Check if Ethan Vernon is there
    const ethan = stageResults.find(r => r.shortName === 'ethan-vernon');
    console.log('Ethan Vernon found:', !!ethan);
    if (ethan) {
      console.log('Ethan Vernon data:', ethan);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testJsonParsing().catch(console.error);
