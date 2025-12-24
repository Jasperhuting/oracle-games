import * as cheerio from 'cheerio';
import { RankedTeamsResult, RankedTeam } from './types';
import { toSlug } from '../firebase/utils';
import { launchBrowser } from './browserHelper';

export interface GetTeamsOptions {
  year: number;
}

export async function getTeamsRankedPuppeteer({ year }: GetTeamsOptions): Promise<RankedTeamsResult> {
  // Use today's date for current year rankings
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();

  const url = `https://www.procyclingstats.com/rankings.php?p=season-teams&s=&date=${currentYear}-${currentMonth}-${currentDay}&nation=&level=&filter=Filter`;

  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the table to load
    await page.waitForSelector('.basic tbody tr', { timeout: 30000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const teams: RankedTeam[] = [];

    $('.basic > tbody > tr').each((_, el) => {
      const nameID = $(el).find('td:nth-child(4) > a').attr('href')?.split('/')[1] || '';

      const team: RankedTeam = {
        rank: Number($(el).find('td').eq(0).text().trim()) || 0,
        name: $(el).find('td:nth-child(4) > a').text().trim(),
        nameID: nameID,
        slug: toSlug(nameID),
        class: $(el).find('td:nth-child(5)').text().trim(),
        country: $(el).find('td:nth-child(4) > span').attr('class')?.split(' ')[1] || '',
        points: Number($(el).find('td:nth-child(6) a').text().trim()) || 0,
      };
      teams.push(team);
    });

    console.log(`Successfully scraped ${teams.length} teams`);

    return {
      count: teams.length,
      source: url,
      teams,
      year,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
