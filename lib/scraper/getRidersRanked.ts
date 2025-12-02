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

  const title = $('title').text();

    
    const getName = (el: DomElement) => {

      const name = $(el).find('td:nth-child(4) > a').text();
      // Match the all-caps last name at the start
      const lastNameUppercase = String(name.match(/^[\p{Lu}\s']+(?=\s\p{Lu}\p{L})/u)?.[0] || '').toLowerCase();
      const lastName = lastNameUppercase.charAt(0).toUpperCase() + lastNameUppercase.slice(1);

      // Extract everything after the last name (the first name part)
      const afterLastName = name.substring(lastNameUppercase.length).trim();
      // Match words that start with uppercase followed by lowercase letters
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