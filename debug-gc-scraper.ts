import { getTourGCResult } from './lib/scraper/index.js';

async function debugPuneGrandTour() {
  try {
    console.log('Testing Pune Grand Tour GC scraper...');
    const result = await getTourGCResult({ race: 'pune-grand-tour', year: 2026 });
    console.log('GC result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

debugPuneGrandTour().catch(console.error);
