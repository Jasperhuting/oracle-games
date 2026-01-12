import * as cheerio from 'cheerio';
import { type StageResult } from './types';
import {
  scrapeStageResults,
  scrapeGeneralClassification,
  scrapePointsClassification,
  scrapeMountainsClassification,
  scrapeYouthClassification,
  scrapeTeamClassification,
} from './getStageResultsItems';
import { launchBrowser } from './browserHelper';

export interface GetRaceResultOptions {
  race: string;
  year: number;
  riders?: number[];
}

/**
 * Scrape results for single-day races (no stages)
 * URL format: https://www.procyclingstats.com/race/{slug}/{year}/result
 * Example: https://www.procyclingstats.com/race/nc-australia-mj-itt/2026/result
 */
export async function getRaceResult({ race, year, riders }: GetRaceResultOptions): Promise<StageResult> {
  // Allow any valid race slug format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(race)) {
    throw new Error(`Invalid race slug format '${race}'. Use lowercase letters, numbers, and hyphens only.`);
  }

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error('Year must be a valid year, e.g., 2025');
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/result`;

  const browser = await launchBrowser();

  let html: string;
  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[getRaceResult] Navigating to: ${url}`);
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

  const raceTitle = $('.page-title > .imob').eq(0).text().trim();

  // Scrape all classifications using modular functions
  // For single-day races, the main results are similar to stage results
  const stageResults = scrapeStageResults($, raceTitle, riders);
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
