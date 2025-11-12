import type { CheerioAPI } from 'cheerio';
import type { ClassificationRider } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape mountains classification results
 */
export function scrapeMountainsClassification($: CheerioAPI): ClassificationRider[] {
  const helpers = createHelpers($);
  const mountainsClassification: ClassificationRider[] = [];
  
  const mountainsClassificationResult = $('#resultsCont > .resTab').eq(3).find('.general');

  mountainsClassificationResult.find('tbody > tr').each((_, el) => {
    // Find the points total (column after team, before delta_pnt)
    const allTds = $(el).find('td');
    const teamTdIndex = allTds.toArray().findIndex(td => $(td).hasClass('cu600'));
    const pointsTotalText = teamTdIndex >= 0 ? $(allTds[teamTdIndex + 1]).text().trim() : '0';
    
    mountainsClassification.push({
      country: helpers.getCountry(el),
      place: helpers.getPlace(el),
      rider: helpers.getLastName(el),
      lastName: helpers.getLastName(el) || '-',
      firstName: helpers.getFirstName(el) || '-',
      team: helpers.getTeam(el),
      shortName: helpers.getRiderShortName(el),
      pointsTotal: Number(pointsTotalText) || 0,
      points: Number($(el).find('td.green').text().trim()) || 0,
    });
  });

  return mountainsClassification;
}
