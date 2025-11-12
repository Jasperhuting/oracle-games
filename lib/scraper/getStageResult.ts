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
  
  const res = await fetch(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' } 
  });
  
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  
  const html = await res.text();
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