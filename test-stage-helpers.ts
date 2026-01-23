import * as cheerio from 'cheerio';
import { launchBrowser } from './lib/scraper/browserHelper';

async function testStageHelpers() {
  console.log('Testing stage helpers with real HTML...');
  
  const url = 'https://www.procyclingstats.com/race/tour-down-under/2026/stage-2';
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('table', { timeout: 30000 });
    const html = await page.content();
    
    const $ = cheerio.load(html);
    
    // Test the first rider row
    const firstRow = $('#resultsCont > .resTab tbody > tr').first();
    
    console.log('=== TESTING FIRST RIDER ===');
    console.log('HTML structure:');
    console.log(firstRow.html());
    
    // Test each helper function
    console.log('\n=== HELPER RESULTS ===');
    
    // Test getLastName
    const lastName1 = firstRow.find('td.ridername > a span.uppercase').text().trim();
    const lastName2 = firstRow.find('td.ridername > a').contents().filter((_, i) => i === 1).text().trim();
    console.log(`getLastName - span.uppercase: "${lastName1}"`);
    console.log(`getLastName - second text node: "${lastName2}"`);
    
    // Test getFirstName
    const linkText = firstRow.find('td.ridername > a').text().trim();
    const firstName = linkText.replace(lastName1, '').trim();
    console.log(`getFirstName - linkText: "${linkText}"`);
    console.log(`getFirstName - result: "${firstName}"`);
    
    // Test getRiderShortName
    const href = firstRow.find('td.ridername > a').attr('href') || '';
    const shortName = href.split('/')[1] || '-';
    console.log(`getRiderShortName - href: "${href}"`);
    console.log(`getRiderShortName - result: "${shortName}"`);
    
    // Test getPoints
    const points1 = firstRow.find('td.pnt').text().trim();
    const points2 = firstRow.find('td.uci_pnt').next('td').text().trim();
    console.log(`getPoints - td.pnt: "${points1}"`);
    console.log(`getPoints - next after uci_pnt: "${points2}"`);
    
    // Test getPlace
    const place1 = Number(firstRow.find('td').eq(0).text().trim());
    const place2 = Number(firstRow.find('td[data-code="rnk"]').text().trim());
    console.log(`getPlace - first td: ${place1}`);
    console.log(`getPlace - data-code="rnk": ${place2}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testStageHelpers().catch(console.error);
