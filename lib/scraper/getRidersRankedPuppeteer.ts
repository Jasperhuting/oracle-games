import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { RankedRider, RankedRidersResult } from './types';

export interface GetRidersOptions {
  offset: number;
  year: number;
}

export async function getRidersRankedPuppeteer({ offset, year }: GetRidersOptions): Promise<RankedRidersResult> {
  const offsetNum = Number(offset) || 0;
  const month = new Date().getMonth() + 1;
  const day = new Date().getDate();

  const url = `https://www.procyclingstats.com/rankings.php?p=me&s=season-individual&date=${year}-${month}-${day}&nation=&age=&page=smallerorequal&team=&teamlevel=&offset=${offsetNum}&filter=Filter`;

  // Use plain puppeteer instead of puppeteer-extra to avoid version issues
  const puppeteer = await import('puppeteer');

  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the table to load
    await page.waitForSelector('.basic tbody tr', { timeout: 30000 });

    const html = await page.content();
    const $ = cheerio.load(html);

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

    console.log(`Successfully scraped ${riders.length} riders for offset ${offsetNum}`);

    return {
      count: riders.length,
      source: url,
      riders,
      year,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
