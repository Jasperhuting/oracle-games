import * as cheerio from 'cheerio';
import { type StageResult } from './types';
import { scrapeGeneralClassification } from './getStageResultsItems';
import { launchBrowser } from './browserHelper';

export interface GetTourGCResultOptions {
  race: string;
  year: number;
}

/**
 * Scrape final General Classification results for multi-day tours
 * URL format: https://www.procyclingstats.com/race/{slug}/{year}/gc/result/result
 * Example: https://www.procyclingstats.com/race/vuelta-al-tachira/2026/gc/result/result
 */
export async function getTourGCResult({ race, year }: GetTourGCResultOptions): Promise<StageResult> {
  // Allow any valid race slug format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(race)) {
    throw new Error(`Invalid race slug format '${race}'. Use lowercase letters, numbers, and hyphens only.`);
  }

  const yearNum = Number(year);
  console.log(`[DEBUG] yearNum: ${yearNum}, isInteger: ${Number.isInteger(yearNum)}, range: ${yearNum >= 1900 && yearNum <= 3000}`);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    console.log(`[DEBUG] Year validation failed for yearNum: ${yearNum}`);
    throw new Error('Year must be a valid year, e.g., 2026');
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/gc/result/result`;

  const browser = await launchBrowser();

  let html: string;
  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[getTourGCResult] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page content to load
    try {
      await page.waitForSelector('.page-title', { timeout: 10000 });
    } catch (error) {
      // Try alternative selectors if page-title is not found
      try {
        await page.waitForSelector('h1', { timeout: 5000 });
      } catch (h1Error) {
        // Check if page shows "no results" or similar message
        const content = await page.content();
        const $ = cheerio.load(content);
        
        if ($('body').text().includes('No results') || 
            $('body').text().includes('Results not available') ||
            $('body').text().includes('No data') ||
            $('body').text().includes('Not started')) {
          throw new Error(`No GC results available for ${race} ${year}. The race may not have finished yet.`);
        }
        
        throw new Error(`Page structure changed or no content found for ${race} ${year} GC results`);
      }
    }

    html = await page.content();
  } finally {
    await browser.close();
  }

  const $ = cheerio.load(html);

  let raceTitle = '';
  if ($('.page-title > .imob').length) {
    raceTitle = $('.page-title > .imob').eq(0).text().trim();
  } else if ($('h1').length) {
    raceTitle = $('h1').eq(0).text().trim();
  } else {
    raceTitle = `${race} ${year} GC`;
  }

  // Scrape only the general classification for the final GC results
  const generalClassification = scrapeGeneralClassification($);

  if (generalClassification.length === 0) {
    console.warn('Warning: No GC riders found. The page structure may have changed or the results are not available yet.');
  }

  return {
    race,
    year: yearNum,
    source: url,
    count: generalClassification.length,
    stageResults: [], // No stage results for GC-only page
    generalClassification,
    pointsClassification: [], // No other classifications on GC page
    mountainsClassification: [],
    youthClassification: [],
    teamClassification: [],
    scrapedAt: new Date().toISOString(),
    isTourGC: true, // Flag to identify this as tour GC data
  };
}
