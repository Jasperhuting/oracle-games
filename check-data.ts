// Simple script to check the actual data structure in Firebase
import { getServerFirebase } from './lib/firebase/server';

async function checkData() {
  try {
    const db = getServerFirebase();
    const doc = await db.collection('scraper-data').doc('tour-down-under-2026-prologue').get();
    
    if (!doc.exists) {
      console.log('Document not found');
      return;
    }
    
    const data = doc.data();
    console.log('Raw stageResults type:', typeof data.stageResults);
    console.log('Raw stageResults length:', data.stageResults.length);
    console.log('First 200 chars of stageResults:', data.stageResults.substring(0, 200));
    
    // Try to parse it
    try {
      const parsed = JSON.parse(data.stageResults);
      console.log('Parsed successfully, length:', parsed.length);
      console.log('First entry:', parsed[0]);
    } catch (e) {
      console.log('Parse failed:', e.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkData().catch(console.error);
