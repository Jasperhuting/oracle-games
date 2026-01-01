import * as cheerio from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import { RankedRider, RankedRidersResult } from './types';
import { launchBrowser } from './browserHelper';

export interface GetRidersOptions {
  offset: number;
}

interface rankedRiderWithoutPoints extends Omit<RankedRider, 'points' | 'rank'> {}

interface RankedRidersResultWithoutPoints extends Omit<RankedRidersResult, 'riders' | 'rank'> {
  riders: rankedRiderWithoutPoints[];
}

export async function getRidersRankedPuppeteerNewYear({ offset }: GetRidersOptions): Promise<RankedRidersResultWithoutPoints> {
  const offsetNum = Number(offset) || 0;
  
  const url = `https://www.procyclingstats.com/rankings.php?s=&nation=&age=&page=smallerorequal&team=&offset=${offsetNum}&teamlevel=&filter=Filter`;

  // Use browserHelper for automatic Vercel/local environment detection
  const browser = await launchBrowser();

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
      const name = $(el).find('td:nth-child(5) > a').text();
      // Match the all-caps last name at the start (handles special chars like Ž, Š, ß, etc.)
      // Include ß which is technically lowercase but appears in uppercase contexts
      const lastNameMatch = name.match(/^[\p{Lu}ß\s'-]+(?=\s+\p{Lu}\p{L})/u);
      const lastNameUppercase = String(lastNameMatch?.[0] || '').trim();

      // Capitalize first letter, rest lowercase (preserves special chars)
      // Special handling for ß: keep it as ß in output (not convert to ss)
      // Keep particles like "van", "de", "der", "von", "di", "da", "le", "la" lowercase
      const particles = ['van', 'de', 'der', 'den', 'von', 'di', 'da', 'le', 'la', 'del', 'della', 'dos', 'das', 'ten', 'ter', 'te'];
      const lastNameParts = lastNameUppercase.split(/\s+/);
      const lastName = lastNameParts.map(part => {
        const lowerPart = part.toLowerCase();

        // Particle? -> keep lowercase (e.g., "van", "de")
        if (particles.includes(lowerPart)) {
          return lowerPart;
        }

        // Support hyphenated names: capitalize each sub-part
        // Also capitalize letter after apostrophe (e.g., O'brien → O'Brien)
        // Also capitalize letter after Mc/Mac prefix (e.g., Mcnulty → McNulty)
        return part
          .split('-')
          .map(sub => {
            // Handle apostrophes and Mc/Mac prefixes within the sub-part
            return sub
              .toLowerCase()
              .split('')
              .map((char, index, arr) => {
                // Capitalize first character
                if (index === 0) return char.toUpperCase();
                // Capitalize character after apostrophe (both ' and ')
                if (index > 0 && (arr[index - 1] === "'" || arr[index - 1] === "'")) return char.toUpperCase();
                // Capitalize character after Mc prefix (e.g., McNulty, McLay, McDonald)
                if (index === 2 && arr[0] === 'm' && arr[1] === 'c') return char.toUpperCase();
                return char;
              })
              .join('');
          })
          .join('-');
      }).join(' ');

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

    const riders: rankedRiderWithoutPoints[] = [];

    $('.basic > tbody > tr').each((_, el) => {
      const nameID = $(el).find('td:nth-child(5) > a').attr('href')?.split('/')[1] || '';

      let teamName = $(el).find('td:nth-child(6) > a').attr('href')?.split('/')[1] || '';

      const rider: rankedRiderWithoutPoints = {
        team: teamName,
        name: getName(el).fullName,
        nameID: nameID,
        lastName: getName(el).lastName,
        firstName: getName(el).firstName,
        country: $(el).find('td:nth-child(5) > span').attr('class')?.split(' ')[1] || ''
      };
      riders.push(rider);
    });

    console.log(`Successfully scraped ${riders.length} riders for offset ${offsetNum}`);

    return {
      count: riders.length,
      source: url,
      riders,
      year: 2026,
      scrapedAt: new Date().toISOString(),
    };
  } finally {
    await browser.close();
  }
}
