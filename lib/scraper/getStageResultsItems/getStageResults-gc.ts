import type { CheerioAPI } from 'cheerio';
import type { ClassificationRider } from '../types';
import { createHelpers } from './shared-helpers';

/**
 * Scrape general classification results
 */
export function scrapeGeneralClassification($: CheerioAPI): ClassificationRider[] {
  const helpers = createHelpers($);
  const generalClassification: ClassificationRider[] = [];
  
  // For tour GC pages, look for the main results table
  // Try to find the resTab with PCS points (usually index 1), fallback to first resTab
  const resTabs = $('#resultsCont > .resTab');
  const resTabCount = resTabs.length;

  console.log(`[GC_SCRAPER] Found ${resTabCount} resTabs`);

  // Use second resTab (index 1) if available, otherwise first (index 0)
  const targetIndex = resTabCount > 1 ? 1 : 0;
  let generalClassificationResult = resTabs.eq(targetIndex).find('table');

  console.log(`[GC_SCRAPER] Using resTab index ${targetIndex}, table found: ${generalClassificationResult.length > 0}`)

  generalClassificationResult.find('tbody > tr').each((_, el) => {
    // For GC, get time from the timelag column using data-code attributes
    let gcTime = '';
    let gcRank = 0;
    
    // Try different selectors for GC rank and time difference
    const rank1 = Number($(el).find('td').eq(0).text().trim());
    const rank2 = Number($(el).find('td[data-code="rnk"]').text().trim());
    gcRank = rank1 || rank2 || 0;
    
    const timelag1 = $(el).find('td[data-code="gc_timelag"]').text().trim();
    const timelag2 = $(el).find('td.fs11').eq(1).text().trim();
    const timeCells = $(el).find('td.time.ar');
    
    if (timelag1) {
      gcTime = timelag1;
    } else if (timelag2) {
      gcTime = timelag2;
    } else if (timeCells.length > 0) {
      // Get the last time cell (GC time is always last)
      const timeCell = timeCells.last();
      gcTime = timeCell.find('.hide').text().trim() || timeCell.find('font').text().trim();
      
      // If time is ",," it means same time as leader
      if (gcTime === ',,') gcTime = '0:00';
    }
    
    // Get PCS points - try data-code="pnt" first, then fallback to td.pnt class
    let pcsPoints = 0;
    let pntCell = $(el).find('td[data-code="pnt"]').text().trim();
    if (!pntCell) {
      pntCell = $(el).find('td.pnt').text().trim();
    }
    if (pntCell && pntCell !== '-' && pntCell !== '') {
      pcsPoints = Number(pntCell) || 0;
    }
    
    // Debug logging for first few riders
    const riderName = helpers.getFirstName(el) + ' ' + helpers.getLastName(el);
    if (generalClassification.length < 5) {
      console.log(`[GC_SCRAPER] Rider ${generalClassification.length + 1}: ${riderName.trim()}, Rank: ${gcRank}, Points: ${pcsPoints}, NameID: ${helpers.getRiderShortName(el)}, Cell 11: "${pntCell}"`);
    }
    
    const rider: ClassificationRider = {
      country: helpers.getCountry(el),
      lastName: helpers.getLastName(el),
      firstName: helpers.getFirstName(el),
      startNumber: helpers.getStartNumber(el),
      gc: helpers.getGc(el),
      place: gcRank, // Use the calculated rank
      timeDifference: gcTime || '-',
      team: helpers.getTeam(el),
      shortName: helpers.getRiderShortName(el),
      uciPoints: helpers.getUciPoints(el),
      points: pcsPoints || undefined, // Use PCS points from Pnt column
      qualificationTime: Number(helpers.getQualificationTime(el)) || undefined,
    };
    generalClassification.push(rider);
  });

  console.log(`[GC_SCRAPER] Found ${generalClassification.length} GC riders`);
  return generalClassification;
}
