import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import type { TeamClassification } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape team classification results
 */
export function scrapeTeamClassification($: CheerioAPI): TeamClassification[] {
  const helpers = createHelpers($);
  const teamClassification: TeamClassification[] = [];
  
  const teamClassificationResult = $('#resultsCont > .resTab').eq(5).find('.general');

  // Team-specific helpers
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

  teamClassificationResult.find('tbody > tr').each((_, el) => {
    teamClassification.push({
      place: helpers.getPlace(el),
      team: getTeamName(el),
      shortName: getTeamNameShort(el),
      class: helpers.getClass(el),
      timeInSeconds: getTeamTime(el),
    });
  });

  return teamClassification;
}
