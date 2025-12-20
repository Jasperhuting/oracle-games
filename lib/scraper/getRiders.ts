import * as cheerio from 'cheerio';
import { KNOWN_RACE_SLUGS, type RaceSlug, type StartlistResult, type Team, type Rider } from './types';
import process from "process";


export interface GetRidersOptions {
  race: RaceSlug;
  year: number;
}

export async function getRiders({ race, year }: GetRidersOptions): Promise<StartlistResult> {
  if (!KNOWN_RACE_SLUGS.includes(race)) {
    throw new Error(`Unknown race slug '${race}'`);
  }

  const yearNum = Number(year);
  if (!Number.isInteger(yearNum) || yearNum < 1900 || yearNum > 3000) {
    throw new Error(`Year must be a valid year, e.g., 2026`);
  }

  const url = `https://www.procyclingstats.com/race/${race}/${yearNum}/startlist`;
  
  const res = await fetch(url, { 
    headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' } 
  });
  
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  
  const html = await res.text();
  const $ = cheerio.load(html);

  const riders: Team[] = [];

  $('.startlist_v4 > li').each((i, el) => {
    const team: Team = {
      image: '',
      id: '',
      name: '',
      shortName: '',
      riders: []
    };

    const shirtUrl = $(el).find('.shirtCont').find('img').attr('src');
    const ridersCont = $(el).find('.ridersCont');

    team.image = shirtUrl;
    team.name = $(ridersCont).find('a.team').text().trim();
    team.shortName = $(ridersCont).find('a.team').attr('href')?.split('/')[1] || '';
    team.riders = [];

    ridersCont.find('li').each((_, el) => {
      const rider: Rider = {
        name: '',
        id: '',
        nameID: '',
        rank: 0,
        points: 0,
        team: undefined,
        country: '',
        startNumber: '',
        dropout: false
      };
      
      const $el = $(el);
      rider.name = $el.find('a').text().trim();
      rider.country = $el.find('.flag').attr('class')?.split(' ')[1] || '';
      rider.startNumber = $el.find('.bib').text().trim();
      rider.dropout = Boolean($el.eq(0).hasClass('dropout')) || 
                     (Boolean($(el).text().includes('DNF')) || Boolean($(el).text().includes('DNS')));
      team?.riders?.push(rider);
    });

    riders.push(team);
  });

  if (riders.length === 0) {
    console.warn('Warning: No riders found. The page structure may have changed or the startlist is not available yet.');
  }

  return {
    race,
    year: yearNum,
    source: url,
    count: riders.length,
    riders,
    scrapedAt: new Date().toISOString(),
  };
}