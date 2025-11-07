import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { KNOWN_RACE_SLUGS, type RaceSlug, type StageResult, type StageRider, type TTTTeamResult, type ClassificationRider, type TeamClassification } from './types';

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

  const stageResults: (StageRider | TTTTeamResult)[] = [];
  const generalClassification: ClassificationRider[] = [];
  const pointsClassification: ClassificationRider[] = [];
  const mountainsClassification: ClassificationRider[] = [];
  const youthClassification: ClassificationRider[] = [];
  const teamClassification: TeamClassification[] = [];

  // Helper functions for scraping
  const getPlace = (el: DomElement) => Number($(el).find('td').eq(0).text().trim());
  const getGc = (el: DomElement) => $(el).find('td.fs11').eq(0).text().trim();
  const breakAway = (el: DomElement) => Boolean($(el).find('td.ridername > .svg_shield').length);
  const getTimeDifferenceGc = (el: DomElement) => $(el).find('td.fs11').eq(1).text().trim();
  const getTimeDifference = (el: DomElement) => {
    // For stage results, get time from the LAST td.time.ar (stage time, not GC time)
    const timeCells = $(el).find('td.time.ar');
    
    if (timeCells.length === 0) return '';
    
    // Get the last time cell (stage time is always last)
    const timeCell = timeCells.last();
    const time = timeCell.find('.hide').text().trim() || timeCell.find('font').text().trim();
    
    // If time is ",," it means same time as previous rider
    if (time === ',,') return '0:00';
    
    return time || '';
  };
  const getStartNumber = (el: DomElement) => $(el).find('td.bibs').text().trim();
  const getCountry = (el: DomElement) => $(el).find('td.ridername > .flag').attr('class')?.split(' ')[1] || '';
  const getLastName = (el: DomElement) => $(el).find('td.ridername > a span.uppercase').text().trim();
  const getFirstName = (el: DomElement) => {
    const fullName = $(el).find('td.ridername > a').text().trim();
    const lastName = $(el).find('td.ridername > a span.uppercase').text().trim();
    return fullName.replace(lastName, '').trim() || '';
  };
  const getTeam = (el: DomElement) => {
    // Find all td.cu600 elements and filter for the one with a team link
    const teamCells = $(el).find('td.cu600');
    for (let i = 0; i < teamCells.length; i++) {
      const cell = teamCells.eq(i);
      const teamLink = cell.find('a[href^="team/"]');
      if (teamLink.length > 0) {
        return teamLink.text().trim();
      }
    }
    return '';
  };
  const getTeamShortName = (el: DomElement) => $(el).find('td.cu600 > a').attr('href')?.split('/')[1] || '';
  const getRiderShortName = (el: DomElement) => $(el).find('td.ridername > a').attr('href')?.split('/')[1] || '';
  const getUciPoints = (el: DomElement) => $(el).find('td.uci_pnt').text().trim();
  const getPoints = (el: DomElement) => $(el).find('td.points').text().trim();
  const getQualificationTime = (el: DomElement) => $(el).find('td.cu600 > .blue').text().trim();
  const getClass = (el: DomElement) => $(el).find('td').eq(4).text().trim();
  
  const getTeamName = (el: DomElement) => $(el).find('span.flag').next().text().trim();
  const getTeamNameShort = (el: DomElement) => $(el).find('span.flag').next().attr('href')?.split('/')[1] || '';
  const getTeamTime = (el: DomElement) => {
    const timeText = $(el).find('td.time.ar > .hide').text().trim();
    if (!timeText || timeText === '0:00') return 0;
    
    // Parse time format like "0:39" or "1:39" to seconds
    const parts = timeText.split(':');
    if (parts.length === 2) {
      const minutes = parseInt(parts[0], 10) || 0;
      const seconds = parseInt(parts[1], 10) || 0;
      return minutes * 60 + seconds;
    }
    return 0;
  };

  const getTTTPlace = (el: DomElement) => Number($(el).find('.mb_w100 .w10').text().trim());
  const getTTTTeamName = (el: DomElement) => $(el).find('span.flag').next().text().trim();
  const getTTTTeamNameShort = (el: DomElement) => $(el).find('span.flag').next().attr('href')?.split('/')[1] || '';
  
  const getTTTSingleRiderFirstName = (el: DomElement) => $(el).find('td > a').text().trim()?.split(' ').pop() || '';
  const getTTTSingleRiderLastName = (el: DomElement) => $(el).find('td > a span.uppercase').text().trim();

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
        breakAway: breakAway(el) || false,
        place: getPlace(el) || 0,
        timeDifferenceGc: getTimeDifferenceGc(el) || '-',
        timeDifference: getTimeDifference(el) || '-',
        team: getTeam(el) || '-',
        shortName: getRiderShortName(el) || '-',
        uciPoints: getUciPoints(el) || '-',
        points: getPoints(el) || '-',
        qualificationTime: Number(getQualificationTime(el)) || undefined,
      };

      if (!riders) {
        stageResults.push(rider);
      } else if (riders?.includes(Number(rider.startNumber))) {
        stageResults.push(rider);
      }
    });
  }

  // Get classification results - use .general to get the correct table
  const stageClassificationResult = $('#resultsCont > .resTab').eq(0).find('.general');
  const generalClassificationResult = $('#resultsCont > .resTab').eq(1).find('.general');
  const pointsClassificationResult = $('#resultsCont > .resTab').eq(2).find('.general');
  const mountainsClassificationResult = $('#resultsCont > .resTab').eq(3).find('.general');
  const youthClassificationResult = $('#resultsCont > .resTab').eq(4).find('.general');
  const teamClassificationResult = $('#resultsCont > .resTab').eq(5).find('.general');

  // Team classification
  teamClassificationResult.find('tbody > tr').each((_, el) => {
    teamClassification.push({
      place: getPlace(el),
      team: getTeamName(el),
      shortName: getTeamNameShort(el),
      class: getClass(el),
      timeInSeconds: getTeamTime(el),
    });
  });

  // Points classification
  pointsClassificationResult.find('tbody > tr').each((_, el) => {
    // Find the points total (column after team, before delta_pnt)
    const allTds = $(el).find('td');
    const teamTdIndex = allTds.toArray().findIndex(td => $(td).hasClass('cu600'));
    const pointsTotalText = teamTdIndex >= 0 ? $(allTds[teamTdIndex + 1]).text().trim() : '0';
    
    pointsClassification.push({
      country: getCountry(el),
      place: getPlace(el),
      lastName: getLastName(el) || '-',
      firstName: getFirstName(el) || '-',
      team: getTeam(el),
      shortName: getRiderShortName(el),
      pointsTotal: Number(pointsTotalText) || 0,
      points: Number($(el).find('td.delta_pnt').text().trim()) || 0,
    });
  });

  // Mountains classification
  mountainsClassificationResult.find('tbody > tr').each((_, el) => {
    // Find the points total (column after team, before delta_pnt)
    const allTds = $(el).find('td');
    const teamTdIndex = allTds.toArray().findIndex(td => $(td).hasClass('cu600'));
    const pointsTotalText = teamTdIndex >= 0 ? $(allTds[teamTdIndex + 1]).text().trim() : '0';
    
    mountainsClassification.push({
      country: getCountry(el),
      place: getPlace(el),
      rider: getLastName(el),
      lastName: getLastName(el) || '-',
      firstName: getFirstName(el) || '-',
      team: getTeam(el),
      shortName: getRiderShortName(el),
      pointsTotal: Number(pointsTotalText) || 0,
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
      shortName: getRiderShortName(el),
    };
    youthClassification.push(rider);
  });

  // General classification
  generalClassificationResult.find('tbody > tr').each((_, el) => {
    // For GC, get time from the LAST td.time.ar (GC time difference)
    const timeCells = $(el).find('td.time.ar');
    let gcTime = '';
    
    if (timeCells.length > 0) {
      // Get the last time cell (GC time is always last)
      const timeCell = timeCells.last();
      gcTime = timeCell.find('.hide').text().trim() || timeCell.find('font').text().trim();
      
      // If time is ",," it means same time as leader
      if (gcTime === ',,') gcTime = '0:00';
    }
    
    const rider: ClassificationRider = {
      country: getCountry(el),
      lastName: getLastName(el),
      firstName: getFirstName(el),
      startNumber: getStartNumber(el),
      gc: getGc(el),
      place: getPlace(el),
      timeDifference: gcTime || '-',
      team: getTeam(el),
      shortName: getRiderShortName(el),
      uciPoints: getUciPoints(el),
      points: Number(getPoints(el)) || undefined,
      qualificationTime: Number(getQualificationTime(el)) || undefined,
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