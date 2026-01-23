import { scrapeRiderData, saveRiderData, getRiderData } from './lib/firebase/rider-scraper-service';

async function testRiderScraper() {
  console.log('Testing rider scraper with Jay Vine (2026)...');
  
  try {
    // Test scraping Jay Vine for 2026
    const riderData = await scrapeRiderData('jay-vine', 2026);
    
    console.log('Scraped data:');
    console.log(`- Name: ${riderData.name}`);
    console.log(`- Total PCS Points: ${riderData.totalPcsPoints}`);
    console.log(`- Total UCI Points: ${riderData.totalUciPoints}`);
    console.log(`- Total Distance: ${riderData.totalDistance} km`);
    console.log(`- Total Racing Days: ${riderData.totalDays}`);
    console.log(`- Number of Results: ${riderData.results.length}`);
    
    // Show first few results
    console.log('\nFirst 3 results:');
    riderData.results.slice(0, 3).forEach((result, index) => {
      console.log(`${index + 1}. ${result.date} - ${result.race}`);
      console.log(`   Position: ${result.position || 'DNF'}`);
      console.log(`   PCS Points: ${result.pcsPoints || 0}`);
      console.log(`   UCI Points: ${result.uciPoints || 0}`);
      if (result.stageNumber && result.stageName) {
        console.log(`   Stage: ${result.stageNumber} - ${result.stageName}`);
      }
      console.log('');
    });
    
    // Test saving to Firestore
    console.log('Saving to Firestore...');
    await saveRiderData({ rider: 'jay-vine', year: 2026 }, riderData);
    console.log('Saved successfully!');
    
    // Test retrieving from Firestore
    console.log('Retrieving from Firestore...');
    const retrievedData = await getRiderData({ rider: 'jay-vine', year: 2026 });
    
    if (retrievedData) {
      console.log('Retrieved successfully!');
      console.log(`Retrieved name: ${retrievedData.name}`);
      console.log(`Retrieved points: ${retrievedData.totalPcsPoints}`);
      console.log(`Retrieved results count: ${retrievedData.results.length}`);
    } else {
      console.log('Failed to retrieve data');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testRiderScraper();
