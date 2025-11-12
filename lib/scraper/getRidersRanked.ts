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

  const url = `https://www.procyclingstats.com/rankings.php?p=individual&s=&nation=&age=&page=smallerorequal&team=&offset=${offsetNum}&teamlevel=&filter=Filter`;
  
  const res = await fetch(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' } 
  });
  
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  
  const html = await res.text();
  const $ = cheerio.load(html);

  const title = $('title').text();

    
    const getName = (el: DomElement) => {

      const name = $(el).find('td:nth-child(5) > a').text();
      const lastNameUppercase = String(name.match(/^[\p{Lu}\s']+(?=\s\p{Lu}\p{Ll})/u)?.[0] || '').toLowerCase();
      const lastName = lastNameUppercase.charAt(0).toUpperCase() + lastNameUppercase.slice(1);
      const firstName = String(name.match(/\b\p{Lu}\p{Ll}+\b/gu) || '').replace(/,/g, ' ');


      return {
        fullName: firstName + ' ' + lastName,
        lastName,
        firstName
      };
    };

  const riders: RankedRider[] = [];

  $('.basic > tbody > tr').each((_, el) => {
    const nameID = $(el).find('td:nth-child(5) > a').attr('href')?.split('/')[1] || '';
    
    const rider: RankedRider = {
      rank: Number($(el).find('td').eq(0).text().trim()) || 0,
      team: $(el).find('td.cu600:not(.fs10) > a').attr('href')?.split('/')[1] || '',
      name: getName(el).fullName,
      nameID: nameID,
      lastName: getName(el).lastName,
      firstName: getName(el).firstName,
      country: $(el).find('td:nth-child(5) > span').attr('class')?.split(' ')[1] || '',
      points: Number($(el).find('td:nth-child(7) a').text().trim()) || 0,
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