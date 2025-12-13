import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { RankedRider, RankedRidersResult } from './types';

export interface GetRidersOptions {
  offset: number;
  year: number;
}

export async function getRidersRanked({ offset, year }: GetRidersOptions): Promise<RankedRidersResult> {
  const offsetNum = Number(offset) || 0;
  

// https://www.procyclingstats.com/rankings.php?p=individual&s=&nation=&age=&page=smallerorequal&team=&offset=0&teamlevel=1&filter=Filter
  const url = `https://www.procyclingstats.com/rankings.php?p=me&s=season-individual&date=2025-12-02&nation=&age=&page=smallerorequal&team=&teamlevel=&offset=${offsetNum}&filter=Filter`;

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.procyclingstats.com/',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
    }
  });

  if (!res.ok) {
    console.error(`Scraper failed for offset ${offsetNum}: ${res.status} ${res.statusText}`);
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  
  const html = await res.text();
  const $ = cheerio.load(html);
    
    const getName = (el: DomElement) => {

      const name = $(el).find('td:nth-child(4) > a').text();
      // Match the all-caps last name at the start (handles special chars like Ž, Š, ß, etc.)
      // Include ß which is technically lowercase but appears in uppercase contexts
      const lastNameMatch = name.match(/^[\p{Lu}ß\s'-]+(?=\s+\p{Lu}\p{L})/u);
      const lastNameUppercase = String(lastNameMatch?.[0] || '').trim();

      // Debug: log apostrophe character code
      if (lastNameUppercase.includes("'") || lastNameUppercase.includes("'") || lastNameUppercase.match(/['']/)) {
        console.log('Name with apostrophe:', lastNameUppercase);
        const apostropheIndex = lastNameUppercase.search(/['']/);
        if (apostropheIndex >= 0) {
          const apostrophe = lastNameUppercase[apostropheIndex];
          console.log('Apostrophe character code:', apostrophe.charCodeAt(0), 'char:', apostrophe);
        }
      }

      // Capitalize first letter, rest lowercase (preserves special chars)
      // Special handling for ß: keep it as ß in output (not convert to ss)
      // Also capitalize letter after apostrophe (e.g., O'brien → O'Brien)
      // Handle both straight apostrophe (') and curly apostrophe (')
      const lastName = lastNameUppercase
        .toLowerCase()
        .split('')
        .map((char, index, arr) => {
          // Capitalize first character
          if (index === 0) return char.toUpperCase();
          // Capitalize character after apostrophe (both ' and ')
          if (index > 0 && (arr[index - 1] === "'" || arr[index - 1] === "'")) return char.toUpperCase();
          return char;
        })
        .join('');

      // Extract everything after the last name (the first name part)
      const afterLastName = name.substring(lastNameUppercase.length).trim();
      // Match words that start with uppercase followed by any letters (handles Ž, É, etc.)
      const firstName = String(afterLastName.match(/\p{Lu}\p{L}*/gu) || '').replace(/,/g, ' ');


      return {
        fullName: firstName + ' ' + lastName,
        lastName,
        firstName
      };
    };

  const riders: RankedRider[] = [];

  $('.basic > tbody > tr').each((_, el) => {
    const nameID = $(el).find('td:nth-child(4) > a').attr('href')?.split('/')[1] || '';

    let teamName = $(el).find('td.cu600:not(.fs10) > a').attr('href')?.split('/')[1] || '';

    if (teamName === 'q365-pro-cycing-team-2025') {
      teamName = 'q365-pro-cycling-team-2025';
    }

    console.log(nameID);
    
    const rider: RankedRider = {
      rank: Number($(el).find('td').eq(0).text().trim()) || 0,
      team: teamName,
      name: getName(el).fullName,
      nameID: nameID,
      lastName: getName(el).lastName,
      firstName: getName(el).firstName,
      country: $(el).find('td:nth-child(4) > span').attr('class')?.split(' ')[1] || '',
      points: Number($(el).find('td:nth-child(6) a').text().trim()) || 0,
    };
    riders.push(rider);
  });

  
  return {
    count: riders.length,
    source: url,
    riders,
    year,
    scrapedAt: new Date().toISOString(),
  };
}