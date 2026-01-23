import * as cheerio from 'cheerio';
import { type StartlistResult, type Team, type Rider } from './types';
import { launchBrowser } from './browserHelper';


export interface GetRidersOptions {
  race: string;
  year: number;
}

export async function getRiders({ race, year }: GetRidersOptions): Promise<StartlistResult> {
  // Allow any valid race slug format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(race)) {
    throw new Error(`Invalid race slug format '${race}'. Use lowercase letters, numbers, and hyphens only.`);
  }

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error(`Year must be a valid year, e.g., 2026`);
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/startlist`;

  const browser = await launchBrowser();

  let html: string;
  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[getRiders] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page content to load
    await page.waitForSelector('.startlist_v4', { timeout: 30000 });

    html = await page.content();
  } finally {
    await browser.close();
  }
  const $ = cheerio.load(html);

  const riders: Team[] = [];

  $('.startlist_v4 > li').each((i, el) => {
    const team: Team = {
      image: '',
      id: '',
      name: '',
      shortName: '',
      riders: []
    };

    const shirtUrl = $(el).find('.shirtCont').find('img').attr('src');
    const ridersCont = $(el).find('.ridersCont');

    team.image = shirtUrl;
    team.name = $(ridersCont).find('a.team').text().trim();
    team.shortName = $(ridersCont).find('a.team').attr('href')?.split('/')[1] || '';
    team.riders = [];

    ridersCont.find('li').each((_, el) => {
      const rider: Rider = {
        name: '',
        id: '',
        nameID: '',
        rank: 0,
        points: 0,
        team: undefined,
        country: '',
        startNumber: '',
        dropout: false
      };
      
      const $el = $(el);
      rider.name = $el.find('a').text().trim();
      rider.country = $el.find('.flag').attr('class')?.split(' ')[1] || '';
      rider.startNumber = $el.find('.bib').text().trim();
      rider.dropout = Boolean($el.eq(0).hasClass('dropout')) || 
                     (Boolean($(el).text().includes('DNF')) || Boolean($(el).text().includes('DNS')));
      team?.riders?.push(rider);
    });

    riders.push(team);
  });

  if (riders.length === 0) {
    console.warn('Warning: No riders found. The page structure may have changed or the startlist is not available yet.');
  }

  return {
    race,
    year: yearNum,
    source: url,
    count: riders.length,
    riders,
    scrapedAt: new Date().toISOString(),
  };
}