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
import { fetchComplementaryTeamClassification } from './getStageResultsItems/getStageResults-complementary-team';

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

  const fetchOptions = {
    selectors: ['.page-title', 'h1', '.result-cont', 'table.results'],
    noDataTexts: ['Results not available', 'No data', 'Not started', 'No results'],
    noDataErrorMessage: `No stage results available for ${race} ${year} stage ${stage}.`,
    logLabel: 'getStageResult',
  };

  let url: string;
  let html: string;

  if (stage === 0) {
    // Some races use /prologue/result, others use /stage-0/result — try both
    const prologueUrl = `https://www.procyclingstats.com/race/${race}/${yearNum}/prologue/result`;
    const stage0Url = `https://www.procyclingstats.com/race/${race}/${yearNum}/stage-0/result`;
    try {
      url = prologueUrl;
      html = await fetchPageHtml({ url, ...fetchOptions });
    } catch {
      url = stage0Url;
      html = await fetchPageHtml({ url, ...fetchOptions });
    }
  } else {
    url = `https://www.procyclingstats.com/race/${race}/${yearNum}/stage-${stage}/result`;
    html = await fetchPageHtml({ url, ...fetchOptions });
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

  // For Giro d'Italia, also fetch team stage classification from complementary-results page
  let complementaryTeamClassification = undefined;
  if (race === 'giro-d-italia' && typeof stage === 'number') {
    complementaryTeamClassification = await fetchComplementaryTeamClassification(race, yearNum, stage);
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
    ...(complementaryTeamClassification !== undefined && { complementaryTeamClassification }),
    scrapedAt: new Date().toISOString(),
  };
}
