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

  // Parse name using the same logic as getRidersRanked.ts
  // Match the all-caps last name at the start (handles special chars like Ž, Š, ß, etc.)
  const lastNameMatch = fullName.match(/^[\p{Lu}ß\s'-]+(?=\s+\p{Lu}\p{L})/u);
  const lastNameUppercase = String(lastNameMatch?.[0] || '').trim();

  // Capitalize first letter, rest lowercase (preserves special chars)
  // Also capitalize letter after apostrophe (e.g., O'brien → O'Brien)
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
  const afterLastName = fullName.substring(lastNameUppercase.length).trim();
  // Match words that start with uppercase followed by any letters (handles Ž, É, etc.)
  const firstName = String(afterLastName.match(/\p{Lu}\p{L}*/gu) || '').replace(/,/g, ' ');

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

  // Extract ranking and points - prefer PCS, fallback to UCI or any other available ranking
  let rank = 0;
  let points = 0;
  let foundPCSRank = false;
  let foundPCSPoints = false;

  // First pass: try to find PCS Rank and PCS Points
  $('.list.horizontal.rdrquickinfo li').each((_, el) => {
    const title = $(el).find('div:first-child').text().trim();
    const value = $(el).find('div:last-child').text().trim();

    if (title === 'PCS Rank') {
      rank = parseInt(value.replace(/\D/g, '')) || 0;
      foundPCSRank = true;
    } else if (title === 'PCS Points') {
      points = parseInt(value.replace(/\D/g, '')) || 0;
      foundPCSPoints = true;
    }
  });

  // Second pass: fallback to UCI or any other ranking if PCS not found
  if (!foundPCSRank || !foundPCSPoints) {
    $('.list.horizontal.rdrquickinfo li').each((_, el) => {
      const title = $(el).find('div:first-child').text().trim();
      const value = $(el).find('div:last-child').text().trim();

      // Fallback to UCI Rank if PCS Rank not found
      if (!foundPCSRank && title === 'UCI Rank') {
        rank = parseInt(value.replace(/\D/g, '')) || 0;
      }
      // Fallback to UCI Points if PCS Points not found
      else if (!foundPCSPoints && title === 'UCI Points') {
        points = parseInt(value.replace(/\D/g, '')) || 0;
      }
      // Generic fallback: any field containing "Rank" or "Points"
      else if (!foundPCSRank && !rank && title.includes('Rank')) {
        rank = parseInt(value.replace(/\D/g, '')) || 0;
      }
      else if (!foundPCSPoints && !points && title.includes('Points')) {
        points = parseInt(value.replace(/\D/g, '')) || 0;
      }
    });
  }

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
