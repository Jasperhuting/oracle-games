import * as cheerio from 'cheerio';
import { KNOWN_RACE_SLUGS, type RaceSlug, type StageResult, type StageRider, type TTTTeamResult, type ClassificationRider, type TeamClassification } from './types';

export interface GetStageResultOptions {
  race: RaceSlug;
  year: number;
  stage: string | number;
}

export async function getStageResult({ race, year, stage }: GetStageResultOptions): Promise<StageResult> {
  if (!KNOWN_RACE_SLUGS.includes(race)) {
    throw new Error(`Unknown race slug '${race}'`);
  }

  console.log('kom je hier?', race, stage, year)

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
  console.log(stageTitle);

  const stageResults: (StageRider | TTTTeamResult)[] = [];
  const generalClassification: ClassificationRider[] = [];
  const pointsClassification: ClassificationRider[] = [];
  const mountainsClassification: ClassificationRider[] = [];
  const youthClassification: ClassificationRider[] = [];
  const teamClassification: TeamClassification[] = [];

  // Helper functions for scraping
  const getPlace = (el: any) => Number($(el).find('td').eq(0).text().trim());
  const getGc = (el: any) => $(el).find('td.fs11').eq(0).text().trim();
  const getTimeDifference = (el: any) => $(el).find('td.fs11').eq(1).text().trim();
  const getStartNumber = (el: any) => $(el).find('td.bibs').text().trim();
  const getCountry = (el: any) => $(el).find('td.ridername > .flag').attr('class')?.split(' ')[1] || '';
  const getLastName = (el: any) => $(el).find('td.ridername > a span.uppercase').text().trim();
  const getFirstName = (el: any) => $(el).find('td.ridername > a').text().trim()?.split(' ').pop() || '';
  const getTeam = (el: any) => $(el).find('td.cu600 > a').text().trim();
  const getShortName = (el: any) => $(el).find('td.cu600 > a').attr('href')?.split('/')[1] || '';
  const getUciPoints = (el: any) => $(el).find('td.uci_pnt').text().trim();
  const getPoints = (el: any) => $(el).find('td.points').text().trim();
  const getQualificationTime = (el: any) => $(el).find('td.cu600 > .blue').text().trim();
  const getClass = (el: any) => $(el).find('td').eq(4).text().trim();
  
  const getTeamName = (el: any) => $(el).find('span.flag').next().text().trim();
  const getTeamNameShort = (el: any) => $(el).find('span.flag').next().attr('href')?.split('/')[1] || '';

  const getTTTPlace = (el: any) => Number($(el).find('.mb_w100 .w10').text().trim());
  const getTTTTeamName = (el: any) => $(el).find('span.flag').next().text().trim();
  const getTTTTeamNameShort = (el: any) => $(el).find('span.flag').next().attr('href')?.split('/')[1] || '';
  
  const getTTTSingleRiderFirstName = (el: any) => $(el).find('td > a').text().trim()?.split(' ').pop() || '';
  const getTTTSingleRiderLastName = (el: any) => $(el).find('td > a span.uppercase').text().trim();

  // Check if this is a Team Time Trial (TTT)
  if (stageTitle.includes('TTT')) {
    const teamTimeTrial = $('#resultsCont > .resTab .ttt-results');
    const teamTimeTrialResults: TTTTeamResult[] = [];

    teamTimeTrial.find('li:not(.hideIfMobile)').each((_, el) => {
      const team: TTTTeamResult = {
        place: getTTTPlace(el),
        team: getTTTTeamName(el),
        shortName: getTTTTeamNameShort(el),
        riders: []
      };

      $(el).find('tbody > tr').each((_, elRider) => {
        const rider = {
          place: getTTTPlace(el),
          firstName: getTTTSingleRiderFirstName(elRider),
          lastName: getTTTSingleRiderLastName(elRider),
        };
        team.riders.push(rider);
      });
      
      teamTimeTrialResults.push(team);
    });

    stageResults.push(...teamTimeTrialResults);
  } else {
    // Regular stage results
    const stageResult = $('#resultsCont > .resTab').eq(0);
    
    stageResult.find('tbody > tr').each((_, el) => {
      const rider: StageRider = {
        country: getCountry(el) || '-',
        lastName: getLastName(el) || '-',
        firstName: getFirstName(el) || '-',
        startNumber: getStartNumber(el) || '-',
        gc: getGc(el) || '-',
        place: getPlace(el) || 0,
        timeDifference: getTimeDifference(el) || '-',
        team: getTeam(el) || '-',
        shortName: getShortName(el) || '-',
        uciPoints: getUciPoints(el) || '-',
        points: getPoints(el) || '-',
        qualificationTime: getQualificationTime(el) || '-',
      };
      stageResults.push(rider);
    });
  }

  // Get classification results
  const generalClassificationResult = $('#resultsCont > .resTab').eq(1);
  const pointsClassificationResult = $('#resultsCont > .resTab').eq(2);
  const mountainsClassificationResult = $('#resultsCont > .resTab').eq(3);
  const youthClassificationResult = $('#resultsCont > .resTab').eq(4);
  const teamClassificationResult = $('#resultsCont > .resTab .general').eq(5);

  // Team classification
  teamClassificationResult.find('tbody > tr').each((_, el) => {
    teamClassification.push({
      place: getPlace(el),
      team: getTeamName(el),
      shortName: getTeamNameShort(el),
      class: getClass(el),
    });
  });

  // Points classification
  pointsClassificationResult.find('tbody > tr').each((_, el) => {
    pointsClassification.push({
      place: getPlace(el),
      rider: getLastName(el),
      team: getTeam(el),
      pointsTotal: Number($(el).find('td.cu600').next().text().trim()) || 0,
      points: Number($(el).find('td.green').text().trim().split('+')[1]) || 0,
    });
  });

  // Mountains classification
  mountainsClassificationResult.find('tbody > tr').each((_, el) => {
    mountainsClassification.push({
      place: getPlace(el),
      rider: getLastName(el),
      team: getTeam(el),
      pointsTotal: Number($(el).find('td.cu600').next().text().trim()) || 0,
      points: Number($(el).find('td.green').text().trim()) || 0,
    });
  });

  // Youth classification
  youthClassificationResult.find('tbody > tr').each((_, el) => {
    const rider: ClassificationRider = {
      country: getCountry(el),
      lastName: getLastName(el),
      firstName: getFirstName(el),
      startNumber: getStartNumber(el),
      place: getPlace(el),
      team: getTeam(el),
      shortName: getShortName(el),
    };
    youthClassification.push(rider);
  });

  // General classification
  generalClassificationResult.find('tbody > tr').each((_, el) => {
    const rider: ClassificationRider = {
      country: getCountry(el),
      lastName: getLastName(el),
      firstName: getFirstName(el),
      startNumber: getStartNumber(el),
      gc: getGc(el),
      place: getPlace(el),
      timeDifference: getTimeDifference(el),
      team: getTeam(el),
      shortName: getShortName(el),
      uciPoints: getUciPoints(el),
      points: Number(getPoints(el)) || undefined,
      qualificationTime: getQualificationTime(el),
    };
    generalClassification.push(rider);
  });

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