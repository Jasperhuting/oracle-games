import * as cheerio from 'cheerio';
import { KNOWN_RACE_SLUGS, type RaceSlug, type StageResult } from './types';
import {
  scrapeStageResults,
  scrapeGeneralClassification,
  scrapePointsClassification,
  scrapeMountainsClassification,
  scrapeYouthClassification,
  scrapeTeamClassification,
} from './getStageResultsItems';
import { launchBrowser } from './browserHelper';

export interface GetStageResultOptions {
  race: RaceSlug;
  year: number;
  stage: string | number;
  riders?: number[];
}

export async function getStageResult({ race, year, stage, riders }: GetStageResultOptions): Promise<StageResult> {
  if (!KNOWN_RACE_SLUGS.includes(race)) {
    throw new Error(`Unknown race slug '${race}'`);
  }

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error('Year must be a valid year, e.g., 2025');
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/stage-${stage}`;

  const browser = await launchBrowser();

  let html: string;
  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[getStageResult] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page content to load
    await page.waitForSelector('.page-title', { timeout: 30000 });

    html = await page.content();
  } finally {
    await browser.close();
  }
  
  const $ = cheerio.load(html);

  const stageTitle = $('.page-title > .imob').eq(0).text().trim();

  // Scrape all classifications using modular functions
  const stageResults = scrapeStageResults($, stageTitle, riders);
  const generalClassification = scrapeGeneralClassification($);
  const pointsClassification = scrapePointsClassification($);
  const mountainsClassification = scrapeMountainsClassification($);
  const youthClassification = scrapeYouthClassification($);
  const teamClassification = scrapeTeamClassification($);

  if (stageResults.length === 0) {
    console.warn('Warning: No riders found. The page structure may have changed or the results are not available yet.');
  }

  return {
    race,
    year: yearNum,
    source: url,
    count: stageResults.length,
    stageResults,
    generalClassification,
    pointsClassification,
    mountainsClassification,
    youthClassification,
    teamClassification,
    scrapedAt: new Date().toISOString(),
  };
}