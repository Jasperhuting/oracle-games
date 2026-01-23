import { scrapeSeasonRanking } from './lib/firebase/ranking-scraper-service';

async function testRankingScraper() {
  console.log('Testing ranking scraper...');
  
  try {
    const rankingData = await scrapeSeasonRanking(2026);
    
    console.log('Scraped data:');
    console.log(`- Year: ${rankingData.year}`);
    console.log(`- Number of riders: ${rankingData.riders.length}`);
    console.log(`- Scraped at: ${rankingData.scrapedAt}`);
    
    if (rankingData.riders.length > 0) {
      console.log('\nFirst 3 riders:');
      rankingData.riders.slice(0, 3).forEach((rider, index) => {
        console.log(`${index + 1}. Rank ${rider.rank}: ${rider.name} (${rider.nameID})`);
        console.log(`   Points: ${rider.points}`);
        console.log(`   Country: ${rider.country}`);
        console.log(`   Team: ${rider.team}`);
        console.log('');
      });
    } else {
      console.log('No riders found. The table parsing might need adjustment.');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Run the test
testRankingScraper();
