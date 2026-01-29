import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import type { StageRider, TTTTeamResult } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape stage results (regular stage or TTT)
 */
export function scrapeStageResults(
  $: CheerioAPI,
  stageTitle: string,
  riders?: number[]
): (StageRider | TTTTeamResult)[] {
  const helpers = createHelpers($);
  const stageResults: (StageRider | TTTTeamResult)[] = [];

  // TTT-specific helpers
  const getTTTPlace = (el: DomElement) => Number($(el).find('.mb_w100 .w10').text().trim());
  const getTTTTeamName = (el: DomElement) => $(el).find('span.flag').next().text().trim();
  const getTTTTeamNameShort = (el: DomElement) => $(el).find('span.flag').next().attr('href')?.split('/')[1] || '';
  const getTTTSingleRiderFirstName = (el: DomElement) => $(el).find('td > a').text().trim()?.split(' ').pop() || '';
  const getTTTSingleRiderLastName = (el: DomElement) => $(el).find('td > a span.uppercase').text().trim();
  // Get rider shortname/nameID from href
  const getTTTRiderShortName = (el: DomElement) => {
    const href = $(el).find('td > a').attr('href') || '';
    const parts = href.split('/').filter(Boolean);
    return parts.find(p => p !== 'rider') || parts[parts.length - 1] || '-';
  };
  // Get PCS points for TTT rider (in w7 mb_w10 column)
  const getTTTRiderPoints = (el: DomElement) => $(el).find('td.w7').text().trim() || '-';

  // Check if this is a Team Time Trial (TTT)
  // Detect by: title contains 'TTT' or 'Team Time Trial', or page has .ttt-results element
  const hasTTTResults = $('.ttt-results').length > 0;
  const isTTT = stageTitle.includes('TTT') || stageTitle.toLowerCase().includes('team time trial') || hasTTTResults;
  
  console.log(`[TTT_SCRAPER] stageTitle: "${stageTitle}", hasTTTResults: ${hasTTTResults}, isTTT: ${isTTT}`);
  
  if (isTTT) {
    const teamTimeTrial = $('.ttt-results');
    const teamTimeTrialResults: TTTTeamResult[] = [];

    console.log(`[TTT_SCRAPER] Found ${teamTimeTrial.find('li:not(.hideIfMobile)').length} teams in TTT results`);

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
          shortName: getTTTRiderShortName(elRider),
          points: getTTTRiderPoints(elRider),
        };
        team.riders.push(rider);
      });
      
      if (teamTimeTrialResults.length < 3) {
        console.log(`[TTT_SCRAPER] Team ${team.place}: ${team.team} with ${team.riders.length} riders`);
        if (team.riders.length > 0) {
          console.log(`[TTT_SCRAPER] First rider: ${team.riders[0].firstName} ${team.riders[0].lastName} (${team.riders[0].shortName}) - ${team.riders[0].points} pts`);
        }
      }
      
      teamTimeTrialResults.push(team);
    });

    console.log(`[TTT_SCRAPER] Total teams: ${teamTimeTrialResults.length}, Total riders: ${teamTimeTrialResults.reduce((sum, t) => sum + t.riders.length, 0)}`);
    stageResults.push(...teamTimeTrialResults);
  } else {
    // Regular stage results
    const stageResult = $('#resultsCont > .resTab').eq(0);
    
    stageResult.find('tbody > tr').each((_, el) => {
      const rider: StageRider = {
        country: helpers.getCountry(el) || '-',
        lastName: helpers.getLastName(el) || '-',
        firstName: helpers.getFirstName(el) || '-',
        startNumber: helpers.getStartNumber(el) || '-',
        gc: helpers.getGc(el) || '-',
        breakAway: helpers.breakAway(el) || false,
        place: helpers.getPlace(el),
        timeDifferenceGc: helpers.getTimeDifferenceGc(el) || '-',
        timeDifference: helpers.getTimeDifference(el) || '-',
        team: helpers.getTeam(el) || '-',
        shortName: helpers.getRiderShortName(el) || '-',
        uciPoints: helpers.getUciPoints(el) || '-',
        points: helpers.getPoints(el) || '-',
        qualificationTime: Number(helpers.getQualificationTime(el)) || undefined,
        // Add the missing fields that calculate-points expects
        name: `${helpers.getFirstName(el) || ''} ${helpers.getLastName(el) || ''}`.trim() || '-',
        nameID: helpers.getRiderShortName(el) || '-',
      };

      if (!riders) {
        stageResults.push(rider);
      } else if (riders?.includes(Number(rider.startNumber))) {
        stageResults.push(rider);
      }
    });
  }

  return stageResults;
}
