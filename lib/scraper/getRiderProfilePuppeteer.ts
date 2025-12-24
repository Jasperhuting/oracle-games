import * as cheerio from 'cheerio';

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

    // Extract team name from the rdr-teams2 section (get the current/most recent team)
    const teamHref = $('.rdr-teams2 li').first().find('a').attr('href');
    const team = teamHref?.replace('team/', '').split('/')[0] || '';

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

    // Extract PCS and UCI points from season summary
    let rank = 0;
    let points = 0;

    const seasonSummary = $('.rdrSeasonSum div').text();

    // Try to extract PCS points first
    const pcsPointsMatch = seasonSummary.match(/PCS points:\s*<b>(\d+)<\/b>/i) || seasonSummary.match(/PCS points:\s*(\d+)/i);
    if (pcsPointsMatch) {
      points = parseInt(pcsPointsMatch[1]) || 0;
    } else {
      // Fallback to UCI points if PCS not found
      const uciPointsMatch = seasonSummary.match(/UCI points:\s*<b>(\d+)<\/b>/i) || seasonSummary.match(/UCI points:\s*(\d+)/i);
      if (uciPointsMatch) {
        points = parseInt(uciPointsMatch[1]) || 0;
      }
    }

    // Try to find rank from any ranking link or text
    // Look for rank patterns in the page
    $('a[href*="rankings"]').each((_, el) => {
      const text = $(el).text().trim();
      const rankMatch = text.match(/(\d+)(?:st|nd|rd|th)?/);
      if (rankMatch && !rank) {
        rank = parseInt(rankMatch[1]) || 0;
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
