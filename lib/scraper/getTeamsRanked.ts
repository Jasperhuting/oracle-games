import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { RankedTeamsResult, RankedTeam } from './types';
import { toSlug } from '../firebase/utils';

export interface GetTeamsOptions {
  year: number;
}

export async function getTeamsRanked({ year }: GetTeamsOptions): Promise<RankedTeamsResult> {
  // Use today's date for current year, or December 31st for past years
  const today = new Date();
  const currentYear = today.getFullYear();

  let dateStr: string;
  if (year >= currentYear) {
    // For current or future years, use today's date
    dateStr = today.toISOString().split('T')[0];
  } else {
    // For past years, use December 31st
    dateStr = `${year}-12-31`;
  }

  const url = `https://www.procyclingstats.com/rankings.php?p=season-teams&s=&date=${dateStr}&nation=&level=&filter=Filter`;
  
  const res = await fetch(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' } 
  });
  
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  
  const html = await res.text();
  const $ = cheerio.load(html);
  const teams: RankedTeam[] = [];

  $('.basic > tbody > tr').each((_, el) => {
    const team: RankedTeam = {
      rank: Number($(el).find('td').eq(0).text().trim()) || 0,
      name: $(el).find('td:nth-child(4) > a').text().trim(),
      nameID: $(el).find('td:nth-child(4) > a').attr('href')?.split('/')[1] || '',
      slug: toSlug($(el).find('td:nth-child(4) > a').attr('href')?.split('/')[1] || ''),
      class: $(el).find('td:nth-child(5)').text().trim(),
      country: $(el).find('td:nth-child(4) > span').attr('class')?.split(' ')[1] || '',
      points: Number($(el).find('td:nth-child(6) a').text().trim()) || 0,
    };
    teams.push(team);
  });

  

  return {
    count: teams.length,
    source: url,
    teams,
    year,
    scrapedAt: new Date().toISOString(),
  };
}