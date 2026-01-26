import { getStageResult } from './lib/scraper/index.js';
import { saveScraperData } from './lib/firebase/scraper-service';

async function rescindTourDownUnderPrologue() {
  try {
    console.log('Re-scraping Tour Down Under 2026 prologue...');
    
    const result = await getStageResult({ 
      race: 'tour-down-under', 
      year: 2026, 
      stage: 0 
    });
    
    console.log('Scraped result:', {
      race: result.race,
      year: result.year,
      count: result.count,
      stageResultsCount: result.stageResults.length,
      gcCount: result.generalClassification.length
    });
    
    // Save the corrected data
    await saveScraperData({
      race: 'tour-down-under',
      year: 2026,
      type: 'stage',
      stage: 0
    }, result);
    
    console.log('Successfully saved corrected data for Tour Down Under 2026 prologue');
    
    // Check first few riders to verify Ethan Vernon is there
    const ethanVernon = result.stageResults.find(rider => 
      'shortName' in rider && rider.shortName?.toLowerCase().includes('ethan')
    );
    
    if (ethanVernon && 'shortName' in ethanVernon) {
      console.log('Found Ethan Vernon:', {
        shortName: ethanVernon.shortName,
        firstName: ethanVernon.firstName,
        lastName: ethanVernon.lastName,
        place: ethanVernon.place,
        points: ethanVernon.points
      });
    } else {
      console.log('Ethan Vernon not found in stage results');
      console.log('First 5 riders:', result.stageResults.slice(0, 5).map(r => {
        if ('shortName' in r) {
          return {
            shortName: r.shortName,
            place: r.place,
            points: r.points
          };
        } else {
          return {
            team: r.team,
            place: r.place
          };
        }
      }));
    }
    
  } catch (error) {
    console.error('Error re-scraping Tour Down Under prologue:', error);
  }
}

rescindTourDownUnderPrologue().catch(console.error);
