import type { CheerioAPI } from 'cheerio';
import type { ClassificationRider } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape general classification results
 */
export function scrapeGeneralClassification($: CheerioAPI): ClassificationRider[] {
  const helpers = createHelpers($);
  const generalClassification: ClassificationRider[] = [];
  
  const generalClassificationResult = $('#resultsCont > .resTab').eq(1).find('.general');

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
      country: helpers.getCountry(el),
      lastName: helpers.getLastName(el),
      firstName: helpers.getFirstName(el),
      startNumber: helpers.getStartNumber(el),
      gc: helpers.getGc(el),
      place: helpers.getPlace(el),
      timeDifference: gcTime || '-',
      team: helpers.getTeam(el),
      shortName: helpers.getRiderShortName(el),
      uciPoints: helpers.getUciPoints(el),
      points: Number(helpers.getPoints(el)) || undefined,
      qualificationTime: Number(helpers.getQualificationTime(el)) || undefined,
    };
    generalClassification.push(rider);
  });

  return generalClassification;
}
