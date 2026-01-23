import * as cheerio from 'cheerio';
import { launchBrowser } from './lib/scraper/browserHelper';

async function debugRankingPage() {
  console.log('Debugging ranking page structure...');
  
  const url = 'https://www.procyclingstats.com/rankings/season-individual';
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
    
    console.log('=== PAGE ANALYSIS ===');
    console.log(`Page title: ${$('title').text()}`);
    console.log(`Number of tables: ${$('table').length}`);
    
    // Find all tables and show their structure
    $('table').each((tableIndex, tableElement) => {
      const $table = $(tableElement);
      console.log(`\n=== TABLE ${tableIndex + 1} ===`);
      console.log(`Rows: ${$table.find('tr').length}`);
      
      // Show first few rows
      $table.find('tr').slice(0, 3).each((rowIndex, rowElement) => {
        const $row = $(rowElement);
        const $cells = $row.find('td, th');
        console.log(`Row ${rowIndex}: ${$cells.length} cells`);
        
        $cells.each((cellIndex, cellElement) => {
          const $cell = $(cellElement);
          const text = $cell.text().trim();
          const hasLink = $cell.find('a').length > 0;
          console.log(`  Cell ${cellIndex}: "${text}" ${hasLink ? '(has link)' : ''}`);
          
          if (hasLink && rowIndex > 0) { // Skip header row
            const $link = $cell.find('a').first();
            console.log(`    Link href: ${$link.attr('href')}`);
          }
        });
      });
    });
    
  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the debug
debugRankingPage();
