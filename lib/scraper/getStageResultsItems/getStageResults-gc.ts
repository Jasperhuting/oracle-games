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
  // Use ResTab 1 (index 1) which contains the final GC results
  let generalClassificationResult = $('#resultsCont > .resTab').eq(1).find('table');
  
  // Fallback selectors for tour GC pages
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('.resTab').eq(1).find('table');
  }
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('#resultsCont > .resTab').eq(0).find('table'); // Try first tab
  }
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('.resTab').eq(0).find('table'); // Try first tab
  }
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('table.rdrResults');
  }
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('#resultsCont table').eq(1); // Try second table
  }
  if (generalClassificationResult.length === 0) {
    generalClassificationResult = $('#resultsCont table').first(); // Fallback to first table
  }

  console.log(`[GC_SCRAPER] Found ${generalClassificationResult.length} GC result tables`);

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
    
    // Get PCS points from the correct column (Cell 10 for ResTab 1)
    let pcsPoints = 0;
    const pntCell = $(el).find('td').eq(10).text().trim(); // Cell 10 contains the points
    if (pntCell && pntCell !== '-' && pntCell !== '') {
      pcsPoints = Number(pntCell) || 0;
    }
    
    // Debug logging for Bryan specifically
    const riderName = helpers.getFirstName(el) + ' ' + helpers.getLastName(el);
    if (riderName.includes('Bryan') || riderName.includes('Obando')) {
      console.log(`[GC_SCRAPER] Bryan found: ${riderName.trim()}, Rank: ${gcRank}, Points: ${pcsPoints}, NameID: ${helpers.getRiderShortName(el)}, Cell 10: "${pntCell}"`);
      
      // Check all cells for Bryan to find the 2 points
      const allCells = $(el).find('td');
      console.log(`[GC_SCRAPER] Bryan has ${allCells.length} cells:`);
      allCells.each((i, cell) => {
        const $cell = $(cell);
        const text = $cell.text().trim();
        if (text === '2' || text === '2.0') {
          console.log(`[GC_SCRAPER] Bryan Cell ${i}: "${text}" <-- FOUND 2 POINTS!`);
        } else if (text && text !== '-' && text !== '') {
          console.log(`[GC_SCRAPER] Bryan Cell ${i}: "${text}"`);
        }
      });
    }
    
    // Also log first few riders
    if (generalClassification.length < 5) {
      console.log(`[GC_SCRAPER] Rider ${generalClassification.length + 1}: ${riderName.trim()}, Rank: ${gcRank}, Points: ${pcsPoints}, NameID: ${helpers.getRiderShortName(el)}`);
    }
    
    const rider: ClassificationRider = {
      country: helpers.getCountry(el),
      lastName: helpers.getLastName(el),
      firstName: helpers.getFirstName(el),
      startNumber: helpers.getStartNumber(el),
      gc: helpers.getGc(el),
      place: gcRank, // Use the calculated rank
      rank: gcRank, // Also set rank field for season points
      timeDifference: gcTime || '-',
      team: helpers.getTeam(el),
      shortName: helpers.getRiderShortName(el),
      nameID: helpers.getRiderShortName(el), // Add nameID for proper matching
      uciPoints: helpers.getUciPoints(el),
      points: pcsPoints || undefined, // Use PCS points from Pnt column
      qualificationTime: Number(helpers.getQualificationTime(el)) || undefined,
    };
    generalClassification.push(rider);
  });

  console.log(`[GC_SCRAPER] Found ${generalClassification.length} GC riders`);
  return generalClassification;
}
