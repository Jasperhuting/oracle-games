import * as cheerio from 'cheerio';

export interface Race {
  slug: string;           // e.g., "tour-de-france"
  name: string;           // e.g., "Tour de France"
  startDate: string;      // ISO date string
  endDate: string;        // ISO date string
  classification: string; // e.g., "2.UWT", "1.UWT", "CC"
  country: string;        // e.g., "France"
}

export interface RacesResult {
  source: string;
  count: number;
  races: Race[];
  scrapedAt: string;
  year: number;
}

/**
 * Scrape races from ProCyclingStats for a given year
 * @param year - The year to scrape races for
 * @returns Promise with races data
 */
export async function getRaces(year: number): Promise<RacesResult> {
  const url = `https://www.procyclingstats.com/races.php?s=&year=${year}&circuit=&class=&filter=Filter`;
  
  console.log(`[getRaces] Fetching races for ${year} from ${url}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.procyclingstats.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'max-age=0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const races: Race[] = [];

    // Find the main races table
    $('table.basic tbody tr').each((index, element) => {
      try {
        const $row = $(element);
        
        // Skip header rows, empty rows, or canceled races (striked class)
        if ($row.find('th').length > 0 || $row.find('td').length < 5 || $row.hasClass('striked')) {
          return;
        }

        // Extract data from columns
        // Column structure: [0]=date, [1]=date (hidden), [2]=race+country, [3]=winner, [4]=class
        const dateText = $row.find('td').eq(0).text().trim();
        const raceCell = $row.find('td').eq(2);
        const raceLink = raceCell.find('a').first();
        const raceName = raceLink.text().trim();
        const raceHref = raceLink.attr('href') || '';
        const classification = $row.find('td').eq(4).text().trim();
        
        // Get country from flag span class (e.g., "flag au" -> "au")
        const flagSpan = raceCell.find('span.flag');
        let country = '';
        if (flagSpan.length > 0) {
          const classes = flagSpan.attr('class')?.split(' ') || [];
          country = classes.find(c => c !== 'flag' && c.length === 2) || '';
        }

        // Skip if essential data is missing
        if (!raceName || !raceHref) {
          return;
        }

        // Extract slug from href (e.g., "race/tour-de-france/2025" -> "tour-de-france")
        // Note: href might not have leading slash
        const slugMatch = raceHref.match(/\/?race\/([^\/]+)/);
        const slug = slugMatch ? slugMatch[1] : '';

        if (!slug) {
          return;
        }

        // Parse date range (e.g., "01.07 - 27.07" or "15.03")
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

        races.push({
          slug,
          name: raceName,
          startDate,
          endDate,
          classification: classification || 'Unknown',
          country: country || 'Unknown',
        });
      } catch (error) {
        console.error('[getRaces] Error parsing row:', error);
      }
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

    const existingSlugs = new Set(races.map(race => race.slug));
    manualRaces.forEach(race => {
      if (!existingSlugs.has(race.slug)) {
        races.push(race);
      }
    });

    console.log(`[getRaces] Successfully scraped ${races.length} races`);

    return {
      source: url,
      count: races.length,
      races,
      scrapedAt: new Date().toISOString(),
      year,
    };
  } catch (error) {
    console.error('[getRaces] Error fetching races:', error);
    throw error;
  }
}

/**
 * Parse PCS date format (DD.MM) to ISO date string
 * @param dateStr - Date string in format "DD.MM"
 * @param year - Year to use
 * @returns ISO date string
 */
function parsePCSDate(dateStr: string, year: number): string {
  const match = dateStr.match(/(\d{2})\.(\d{2})/);
  if (!match) return '';
  
  const [, day, month] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
