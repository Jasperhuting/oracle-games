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
import { fetchPageHtml } from './browserHelper';

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
    throw new Error('Year must be a valid year, e.g., 2026');
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/result`;
  const html = await fetchPageHtml({
    url,
    selectors: ['.page-title', 'h1', '.result-cont', 'table.results'],
    noDataTexts: [
      'Results not available',
      'No data',
      'Not started',
      'No results',
    ],
    noDataErrorMessage: `No results available for ${race} ${year}. The race may not have finished yet.`,
    logLabel: 'getRaceResult',
  });

  const $ = cheerio.load(html);

  let raceTitle = '';
  if ($('.page-title > .imob').length) {
    raceTitle = $('.page-title > .imob').eq(0).text().trim();
  } else if ($('h1').length) {
    raceTitle = $('h1').eq(0).text().trim();
  } else {
    raceTitle = `${race} ${year}`;
  }

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
