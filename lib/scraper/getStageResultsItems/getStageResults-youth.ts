import type { CheerioAPI } from 'cheerio';
import type { ClassificationRider } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape youth classification results
 */
export function scrapeYouthClassification($: CheerioAPI): ClassificationRider[] {
  const helpers = createHelpers($);
  const youthClassification: ClassificationRider[] = [];
  
  const youthClassificationResult = $('#resultsCont > .resTab').eq(4).find('.general');

  youthClassificationResult.find('tbody > tr').each((_, el) => {
    const rider: ClassificationRider = {
      country: helpers.getCountry(el),
      lastName: helpers.getLastName(el),
      firstName: helpers.getFirstName(el),
      startNumber: helpers.getStartNumber(el),
      place: helpers.getPlace(el),
      team: helpers.getTeam(el),
      shortName: helpers.getRiderShortName(el),
    };
    youthClassification.push(rider);
  });

  return youthClassification;
}
