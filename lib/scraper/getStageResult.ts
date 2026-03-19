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

export interface GetStageResultOptions {
  race: string;
  year: number;
  stage: string | number;
  riders?: number[];
}

export async function getStageResult({ race, year, stage, riders }: GetStageResultOptions): Promise<StageResult> {
  // Allow any valid race slug format (lowercase, alphanumeric with hyphens)
  if (!/^[a-z0-9-]+$/.test(race)) {
    throw new Error(`Invalid race slug format '${race}'. Use lowercase letters, numbers, and hyphens only.`);
  }

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error('Year must be a valid year, e.g., 2026');
  }

  const url = stage === 0 ?
    `https://www.procyclingstats.com/race/${race}/${yearNum}/prologue/result` :
    `https://www.procyclingstats.com/race/${race}/${yearNum}/stage-${stage}/result`;
  const html = await fetchPageHtml({
    url,
    selectors: ['.page-title', 'h1', '.result-cont', 'table.results'],
    noDataTexts: ['Results not available', 'No data', 'Not started', 'No results'],
    noDataErrorMessage: `No stage results available for ${race} ${year} stage ${stage}.`,
    logLabel: 'getStageResult',
  });
  
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
