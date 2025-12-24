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
  age?: number;
  dateOfBirth?: string;
}

export async function getRiderProfile(url: string): Promise<RiderProfileData> {
  // Extract nameID from URL
  const nameID = url.split('/rider/')[1]?.replace(/\/$/, '') || '';

  if (!nameID) {
    throw new Error('Invalid ProCyclingStats rider URL. Expected format: https://www.procyclingstats.com/rider/[rider-name]');
  }

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
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Check if page exists
  const pageTitle = $('title').text().trim();
  if (pageTitle.toLowerCase().includes('page not found') || pageTitle.toLowerCase().includes('404')) {
    throw new Error(`Rider not found: ${nameID}`);
  }

  // Extract rider name from page title
  const fullName = $('h1').first().text().trim();

  // Parse name into first and last name
  const nameParts = fullName.split(' ');
  const firstName = nameParts.slice(0, -1).join(' ');
  const lastName = nameParts[nameParts.length - 1];

  // Extract country from flag
  const country = $('.rdr-info-cont .flag').attr('class')?.split(' ')[1] || '';

  // Extract team name
  const teamHref = $('.rdr-info-cont a[href*="/team/"]').attr('href');
  const team = teamHref?.split('/team/')[1]?.replace(/\/$/, '') || '';

  // Extract date of birth and calculate age
  let age: number | undefined;
  let dateOfBirth: string | undefined;

  $('.rdr-info-cont .list.circle.rdr-info-list li').each((_, el) => {
    const text = $(el).text().trim();
    if (text.includes('Date of birth:')) {
      // Format: "Date of birth: 1st January 2003 (22)"
      const dobMatch = text.match(/Date of birth:\s*(.+?)\s*\((\d+)\)/);
      if (dobMatch) {
        dateOfBirth = dobMatch[1].trim();
        age = parseInt(dobMatch[2]);
      }
    }
  });

  // Extract UCI ranking and points
  let rank = 0;
  let points = 0;

  $('.list.horizontal.rdrquickinfo li').each((_, el) => {
    const title = $(el).find('div:first-child').text().trim();
    const value = $(el).find('div:last-child').text().trim();

    if (title === 'PCS Rank') {
      rank = parseInt(value.replace(/\D/g, '')) || 0;
    } else if (title === 'PCS Points') {
      points = parseInt(value.replace(/\D/g, '')) || 0;
    }
  });

  return {
    name: fullName,
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
}
