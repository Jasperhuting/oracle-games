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
      const text1 = $(el).find('td').eq(0).text().trim();
      const text2 = $(el).find('td[data-code="rnk"]').text().trim();

      // Parse place from first column
      const place1 = text1 ? Number(text1) : NaN;
      // Parse place from data-code="rnk" column
      const place2 = text2 ? Number(text2) : NaN;

      // Return the first valid number (not NaN), or -1 if both fail
      // Using -1 instead of 0 to indicate "no valid position found"
      // since 0 could be a valid position (e.g., prologue winner or edge case)
      if (!isNaN(place1) && place1 >= 0) return place1;
      if (!isNaN(place2) && place2 >= 0) return place2;
      return -1;
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
    getCountry: (el: DomElement) => {
      // Try multiple selectors for country flag
      const flag1 = $(el).find('td.ridername > .flag').attr('class')?.split(' ')[1];
      const flag2 = $(el).find('td.ridername .flag').attr('class')?.split(' ')[1];
      const flag3 = $(el).find('.flag').attr('class')?.split(' ')[1];
      return flag1 || flag2 || flag3 || '';
    },
    getLastName: (el: DomElement) => {
      // Try multiple selectors for last name
      // 1. Inside div.cont (newer PCS structure)
      const lastName1 = $(el).find('td.ridername .cont a span.uppercase').text().trim();
      // 2. Direct in ridername cell (older structure)
      const lastName2 = $(el).find('td.ridername a span.uppercase').text().trim();
      // 3. Any uppercase span in a link
      const lastName3 = $(el).find('a span.uppercase').text().trim();
      // 4. Try data-code attribute
      const lastName4 = $(el).find('td[data-code="ridernamelink"] span.uppercase').text().trim();
      return lastName1 || lastName2 || lastName3 || lastName4 || '-';
    },

    getFirstName: (el: DomElement) => {
      // Try multiple selectors for first name
      // First, get the full link text
      const linkText1 = $(el).find('td.ridername .cont a').text().trim();
      const linkText2 = $(el).find('td.ridername a').text().trim();
      const linkText3 = $(el).find('td[data-code="ridernamelink"] a').text().trim();
      const linkText = linkText1 || linkText2 || linkText3 || '';

      // Get the last name to extract first name
      const lastName1 = $(el).find('td.ridername .cont a span.uppercase').text().trim();
      const lastName2 = $(el).find('td.ridername a span.uppercase').text().trim();
      const lastName3 = $(el).find('a span.uppercase').text().trim();
      const lastName = lastName1 || lastName2 || lastName3 || '';

      const firstName = linkText.replace(lastName, '').trim();
      return firstName || '-';
    },

    getRiderShortName: (el: DomElement) => {
      // Try multiple selectors for rider href/shortname
      const href1 = $(el).find('td.ridername .cont a').attr('href');
      const href2 = $(el).find('td.ridername a').attr('href');
      const href3 = $(el).find('td[data-code="ridernamelink"] a').attr('href');
      const href = href1 || href2 || href3 || '';

      // Extract rider slug from href (e.g., "/rider/tadej-pogacar" -> "tadej-pogacar")
      const parts = href.split('/').filter(Boolean);
      // Usually the pattern is /rider/name or just /name
      const shortName = parts.find(p => p !== 'rider') || parts[parts.length - 1] || '-';
      return shortName;
    },
    getUciPoints: (el: DomElement) => $(el).find('td.uci_pnt').text().trim(),
    // Get Pnt column - this is the race-specific points (15, 10, 7, 4, 2, 1 etc)
    // The column right after UCI points column
    getPoints: (el: DomElement) => {
      // Try specific class selectors first
      const points = $(el).find('td.points').text().trim();
      if (points && points !== '-' && points !== '') return points;
      const pnt = $(el).find('td.pnt').text().trim();
      if (pnt && pnt !== '-' && pnt !== '') return pnt;

      // Try to find by position (Pnt column is usually right after UCI points)
      const uciCell = $(el).find('td.uci_pnt');
      if (uciCell.length > 0) {
        const pntCell = uciCell.next('td.pnt');
        if (pntCell.length > 0) {
          const pntText = pntCell.text().trim();
          if (pntText && pntText !== '-' && pntText !== '') return pntText;
        }
      }

      return '-';
    },
    getTeam: (el: DomElement) => {
      // Find team in different column positions/selectors
      const team1 = $(el).find('td.cu600').text().trim();
      const team2 = $(el).find('td[data-code="teamnamelink"]').text().trim();
      const team3 = $(el).find('td.team a').text().trim();
      const team4 = $(el).find('td.team').text().trim();
      // Sometimes team is in a span with specific class
      const team5 = $(el).find('td span.teamname').text().trim();
      return team1 || team2 || team3 || team4 || team5 || '';
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
