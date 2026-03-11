import * as cheerio from 'cheerio';
import { type StageResult } from './types';
import { scrapeGeneralClassification } from './getStageResultsItems';
import { fetchPageHtml } from './browserHelper';

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
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error('Year must be a valid year, e.g., 2026');
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/gc/result/result`;
  const html = await fetchPageHtml({
    url,
    selectors: ['.page-title', 'h1', '.result-cont', 'table.results'],
    noDataTexts: ['Results not available', 'No data', 'Not started', 'No results'],
    noDataErrorMessage: `No GC results available for ${race} ${year}. The race may not have finished yet.`,
    logLabel: 'getTourGCResult',
  });

  const $ = cheerio.load(html);

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
