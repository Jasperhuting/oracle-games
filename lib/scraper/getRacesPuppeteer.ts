import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

export interface Race {
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  classification: string;
  country: string;
}

export interface RacesResult {
  source: string;
  count: number;
  races: Race[];
  scrapedAt: string;
  year: number;
}

export async function getRacesPuppeteer(year: number): Promise<RacesResult> {
  const url = `https://www.procyclingstats.com/races.php?s=&year=${year}&circuit=&class=&filter=Filter`;
  
  console.log(`[getRacesPuppeteer] Fetching races for ${year} from ${url}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for the table to load
    await page.waitForSelector('table.basic tr', { timeout: 30000 });

    // Get HTML content and parse with cheerio to avoid TypeScript serialization issues
    const html = await page.content();
    const $ = cheerio.load(html);
    const racesData: Race[] = [];

    function parsePCSDate(dateStr: string, yr: number): string {
      const match = dateStr.match(/(\d{2})\.(\d{2})/);
      if (!match) return '';
      const [, day, month] = match;
      return `${yr}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    $('table.basic tr').each((index, element) => {
      const $row = $(element);
      
      // Skip header rows, empty rows, or canceled races
      if ($row.find('th').length > 0 || $row.find('td').length < 5 || $row.hasClass('striked')) {
        return;
      }

      const dateText = $row.find('td').eq(0).text().trim();
      const raceCell = $row.find('td').eq(2);
      const raceLink = raceCell.find('a').first();
      const raceName = raceLink.text().trim();
      const raceHref = raceLink.attr('href') || '';
      const classification = $row.find('td').eq(4).text().trim();
      
      const flagSpan = raceCell.find('span.flag');
      let country = '';
      if (flagSpan.length > 0) {
        const classes = flagSpan.attr('class')?.split(' ') || [];
        country = classes.find(c => c !== 'flag' && c.length === 2) || '';
      }

      if (!raceName || !raceHref) return;

      const slugMatch = raceHref.match(/\/?race\/([^\/]+)/);
      const slug = slugMatch ? slugMatch[1] : '';
      if (!slug) return;

      let startDate = '';
      let endDate = '';
      
      if (dateText.includes(' - ')) {
        const [start, end] = dateText.split(' - ').map(d => d.trim());
        startDate = parsePCSDate(start, year);
        endDate = parsePCSDate(end, year);
      } else if (dateText.includes('›')) {
        const [start, end] = dateText.split('›').map(d => d.trim());
        startDate = parsePCSDate(start, year);
        endDate = parsePCSDate(end, year);
      } else if (dateText) {
        startDate = parsePCSDate(dateText, year);
        endDate = startDate;
      }

      racesData.push({
        slug,
        name: raceName,
        startDate,
        endDate,
        classification: classification || 'Unknown',
        country: country || 'Unknown',
      });
    });

    const manualRaces: Race[] = [];

    if (year === 2026) {
      manualRaces.push({
        slug: 'asian-continental-championships-mixed-relay-ttt',
        name: 'Asian Continental Championships - Mixed Relay TTT',
        startDate: '2026-02-07',
        endDate: '2026-02-07',
        classification: 'CC',
        country: 'sa',
      });
    }

    const existingSlugs = new Set(racesData.map(race => race.slug));
    manualRaces.forEach(race => {
      if (!existingSlugs.has(race.slug)) {
        racesData.push(race);
      }
    });

    console.log(`[getRacesPuppeteer] Successfully scraped ${racesData.length} races`);

    return {
      source: url,
      count: racesData.length,
      races: racesData,
      scrapedAt: new Date().toISOString(),
      year,
    };
  } catch (error) {
    console.error('[getRacesPuppeteer] Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}
