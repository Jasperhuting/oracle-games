import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';

/**
 * Shared helper functions for scraping stage results
 */
export function createHelpers($: CheerioAPI) {
  return {
    // Basic getters
    getPlace: (el: DomElement) => {
      // Try different column positions for place/rank
      const place1 = Number($(el).find('td').eq(0).text().trim());
      const place2 = Number($(el).find('td[data-code="rnk"]').text().trim());
      return place1 || place2 || 0;
    },
    getGc: (el: DomElement) => $(el).find('td.fs11').eq(0).text().trim(),
    breakAway: (el: DomElement) => Boolean($(el).find('td.ridername > .svg_shield').length),
    getTimeDifferenceGc: (el: DomElement) => $(el).find('td.fs11').eq(1).text().trim(),
    getStartNumber: (el: DomElement) => {
      // Try different selectors for bib/start number
      const bib1 = $(el).find('td.bibs').text().trim();
      const bib2 = $(el).find('td[data-code="bib"]').text().trim();
      return bib1 || bib2 || '';
    },
    getCountry: (el: DomElement) => $(el).find('td.ridername > .flag').attr('class')?.split(' ')[1] || '',
    getLastName: (el: DomElement) => $(el).find('td.ridername > a span.uppercase').text().trim(),
    
    getFirstName: (el: DomElement) => {
      const fullName = $(el).find('td.ridername > a').text().trim();
      const lastName = $(el).find('td.ridername > a span.uppercase').text().trim();
      return fullName.replace(lastName, '').trim() || '';
    },
    
    getTeam: (el: DomElement) => {
      // Find team in different column positions
      const team1 = $(el).find('td.cu600').text().trim();
      const team2 = $(el).find('td[data-code="teamnamelink"]').text().trim();
      return team1 || team2 || '';
    },
    
    getTeamShortName: (el: DomElement) => $(el).find('td.cu600 > a').attr('href')?.split('/')[1] || '',
    getRiderShortName: (el: DomElement) => $(el).find('td.ridername > a').attr('href')?.split('/')[1] || '',
    getUciPoints: (el: DomElement) => $(el).find('td.uci_pnt').text().trim(),
    // Get Pnt column - this is the race-specific points (15, 10, 7, 4, 2, 1 etc)
    // The column right after UCI points column
    getPoints: (el: DomElement) => {
      // Try specific class selectors first
      const points = $(el).find('td.points').text().trim();
      if (points && points !== '-' && points !== '') return points;
      const pnt = $(el).find('td.pnt').text().trim();
      if (pnt && pnt !== '-' && pnt !== '') return pnt;

      // Fallback: find by position - Pnt is usually the column after UCI points
      const uciCell = $(el).find('td.uci_pnt');
      if (uciCell.length) {
        const nextCell = uciCell.next('td');
        const pntValue = nextCell.text().trim();
        if (pntValue && pntValue !== '-' && pntValue !== '') return pntValue;
      }

      return '-';
    },
    getQualificationTime: (el: DomElement) => $(el).find('td.cu600 > .blue').text().trim(),
    getClass: (el: DomElement) => $(el).find('td').eq(4).text().trim(),
    
    // Time difference for stage results
    getTimeDifference: (el: DomElement) => {
      // For stage results, get time from the LAST td.time.ar (stage time, not GC time)
      const timeCells = $(el).find('td.time.ar');
      
      if (timeCells.length === 0) return '';
      
      // Get the last time cell (stage time is always last)
      const timeCell = timeCells.last();
      const time = timeCell.find('.hide').text().trim() || timeCell.find('font').text().trim();
      
      // If time is ",," it means same time as previous rider
      if (time === ',,') return '0:00';
      
      return time || '';
    },
  };
}
