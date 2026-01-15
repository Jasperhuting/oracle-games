import * as cheerio from 'cheerio';
import { launchBrowser } from './browserHelper';

export interface RiderProfileData {
  name: string;
  firstName: string;
  lastName: string;
  nameID: string;
  country: string;
  team: string;
  points: number;
  rank: number;
  age?: string; // Date string in YYYY-MM-DD format
  dateOfBirth?: string;
}

export async function getRiderProfilePuppeteer(url: string): Promise<RiderProfileData> {
  // Extract nameID from URL
  const nameID = url.split('/rider/')[1]?.replace(/\/$/, '') || '';

  if (!nameID) {
    throw new Error('Invalid ProCyclingStats rider URL. Expected format: https://www.procyclingstats.com/rider/[rider-name]');
  }

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

    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 30000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    // Check if page exists
    const pageTitle = $('title').text().trim();
    if (pageTitle.toLowerCase().includes('page not found') || pageTitle.toLowerCase().includes('404')) {
      throw new Error(`Rider not found: ${nameID}`);
    }

    // Extract rider name from h1
    // The name in h1 is already in the format "Firstname Lastname" (not uppercase like in rankings)
    const fullName = $('h1').first().text().trim().replace(/\s+/g, ' '); // Normalize multiple spaces to single

    // Simple split - last word is lastname, rest is firstname
    const nameParts = fullName.split(' ').filter(p => p.length > 0);
    const lastName = nameParts[nameParts.length - 1];
    const firstName = nameParts.slice(0, -1).join(' ');

    // Extract country from nationality section
    let country = '';
    $('.list li').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Nationality:')) {
        country = $(el).find('.flag').attr('class')?.split(' ').pop() || '';
      }
    });

    // Extract team name from the rdr-teams2 section
    // Look for the team in season 2026
    let team = '';
    $('.rdr-teams2 li').each((_, el) => {
      const season = $(el).find('.season').text().trim();
      if (season === '2026') {
        const href = $(el).find('a').attr('href');
        if (href) {
          // Handle both /team/ and /teams/ prefixes, and extract just the slug
          team = href.replace(/^\/?(teams?\/)?/, '').split('/')[0];
          return false; // Break the loop once we found 2026
        }
      }
    });

    // Extract date of birth and convert to YYYY-MM-DD format
    let age: string | undefined;
    let dateOfBirth: string | undefined;

    $('.list li').each((_, el) => {
      const text = $(el).text();
      if (text.includes('Date of birth:')) {
        // Extract birth date parts - format: "20th June 2005"
        const dateMatch = text.match(/Date of birth:(.+?)(?:\(|$)/);
        if (dateMatch) {
          const rawDate = dateMatch[1].trim();
          dateOfBirth = rawDate;

          // Parse date string to YYYY-MM-DD format
          // Example: "20th June 2005" or "20thJune2005"
          const monthMap: Record<string, string> = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
          };

          // Extract day, month, year
          const dayMatch = rawDate.match(/(\d+)(?:st|nd|rd|th)?/);
          const monthMatch = rawDate.match(/(january|february|march|april|may|june|july|august|september|october|november|december)/i);
          const yearMatch = rawDate.match(/(\d{4})/);

          if (dayMatch && monthMatch && yearMatch) {
            const day = dayMatch[1].padStart(2, '0');
            const month = monthMap[monthMatch[1].toLowerCase()];
            const year = yearMatch[1];
            age = `${year}-${month}-${day}`;
          }
        }
      }
    });

    // Extract PCS points and rank from "PCS Ranking position per season" table
    // Look for the 2025 row and get points (2nd column) and rank (3rd column)
    let rank = 0;
    let points = 0;

    // Find the table with PCS Ranking position per season
    $('h4').each((_, h4) => {
      if ($(h4).text().includes('PCS Ranking position per season')) {
        const table = $(h4).next('table');
        table.find('tbody tr').each((_, row) => {
          const cells = $(row).find('td');
          const yearLink = cells.eq(0).find('a').attr('href') || '';
          // Check if this is the 2025 row
          if (yearLink.includes('2025')) {
            // Points are in the second column (inside .title element)
            const pointsText = cells.eq(1).find('.title').text().trim();
            points = parseInt(pointsText) || 0;
            // Rank is in the third column
            const rankText = cells.eq(2).text().trim();
            rank = parseInt(rankText) || 0;
            return false; // Break the loop
          }
        });
      }
    });

    console.log(`Successfully scraped rider: ${firstName} ${lastName}`);

    return {
      name: firstName + ' ' + lastName,
      firstName,
      lastName,
      nameID,
      country,
      team,
      points,
      rank,
      age,
      dateOfBirth,
    };
  } finally {
    await browser.close();
  }
}
