import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';

/**
 * Shared helper functions for scraping stage results
 */
export function createHelpers($: CheerioAPI) {
  return {
    // Basic getters
    getPlace: (el: DomElement) => Number($(el).find('td').eq(0).text().trim()),
    getGc: (el: DomElement) => $(el).find('td.fs11').eq(0).text().trim(),
    breakAway: (el: DomElement) => Boolean($(el).find('td.ridername > .svg_shield').length),
    getTimeDifferenceGc: (el: DomElement) => $(el).find('td.fs11').eq(1).text().trim(),
    getStartNumber: (el: DomElement) => $(el).find('td.bibs').text().trim(),
    getCountry: (el: DomElement) => $(el).find('td.ridername > .flag').attr('class')?.split(' ')[1] || '',
    getLastName: (el: DomElement) => $(el).find('td.ridername > a span.uppercase').text().trim(),
    
    getFirstName: (el: DomElement) => {
      const fullName = $(el).find('td.ridername > a').text().trim();
      const lastName = $(el).find('td.ridername > a span.uppercase').text().trim();
      return fullName.replace(lastName, '').trim() || '';
    },
    
    getTeam: (el: DomElement) => {
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
    },
    
    getTeamShortName: (el: DomElement) => $(el).find('td.cu600 > a').attr('href')?.split('/')[1] || '',
    getRiderShortName: (el: DomElement) => $(el).find('td.ridername > a').attr('href')?.split('/')[1] || '',
    getUciPoints: (el: DomElement) => $(el).find('td.uci_pnt').text().trim(),
    getPoints: (el: DomElement) => $(el).find('td.points').text().trim(),
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
