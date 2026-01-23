import { getServerFirebase } from './lib/firebase/server';

async function debugScraperData() {
  console.log('Debugging scraper data...');
  
  const db = getServerFirebase();
  
  // Check Tour Down Under stage 2 data
  const docId = 'tour-down-under-2026-stage-2';
  const doc = await db.collection('scraper-data').doc(docId).get();
  
  if (!doc.exists) {
    console.log(`No scraper data found for ${docId}`);
    return;
  }
  
  const data = doc.data();
  console.log(`=== SCRAPER DATA FOR ${docId} ===`);
  console.log(`Document exists: ${doc.exists}`);
  console.log(`Stage results type: ${typeof data.stageResults}`);
  console.log(`Stage results length: ${data.stageResults?.length || 0}`);
  
  if (data.stageResults && data.stageResults.length > 0) {
    console.log('\nFirst 3 stage results:');
    data.stageResults.slice(0, 3).forEach((result: any, index: number) => {
      console.log(`Result ${index + 1}:`);
      console.log(`  name: ${result.name}`);
      console.log(`  nameID: ${result.nameID}`);
      console.log(`  shortName: ${result.shortName}`);
      console.log(`  place: ${result.place}`);
      console.log(`  points: ${result.points}`);
      console.log('');
    });
  }
  
  // Check if data is stringified
  if (typeof data.stageResults === 'string') {
    console.log('Stage results is stringified, attempting to parse...');
    try {
      const parsed = JSON.parse(data.stageResults);
      console.log(`Parsed successfully, length: ${parsed.length}`);
      
      if (parsed.length > 0) {
        console.log('\nFirst 3 parsed results:');
        parsed.slice(0, 3).forEach((result: any, index: number) => {
          console.log(`Parsed ${index + 1}:`);
          console.log(`  name: ${result.name}`);
          console.log(`  nameID: ${result.nameID}`);
          console.log(`  shortName: ${result.shortName}`);
          console.log(`  place: ${result.place}`);
          console.log(`  points: ${result.points}`);
          console.log('');
        });
      }
    } catch (e) {
      console.error('Failed to parse stageResults:', e);
    }
  }
}

// Run the debug
debugScraperData().catch(console.error);
