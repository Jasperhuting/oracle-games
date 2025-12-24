import { getRiderProfilePuppeteer } from '../lib/scraper/getRiderProfilePuppeteer';

async function testScraper() {
  const url = 'https://www.procyclingstats.com/rider/titouan-fontaine';

  console.log('Testing rider scraper with URL:', url);
  console.log('---');

  try {
    const result = await getRiderProfilePuppeteer(url);
    console.log('Success! Scraped data:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error scraping rider:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testScraper();
