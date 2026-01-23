import { getServerFirebase } from './server';
import { type DocumentData } from 'firebase-admin/firestore';
import { cleanFirebaseData } from './utils';
import { RiderSeasonData, RiderResult } from '../scraper/types';
import * as cheerio from 'cheerio';
import { launchBrowser } from '../scraper/browserHelper';

export interface RiderDataKey {
  rider: string;
  year: number;
}

export function generateRiderDocumentId(key: RiderDataKey): string {
  return `rider-${key.rider}-${key.year}`;
}

export async function saveRiderData(
  key: RiderDataKey,
  data: RiderSeasonData
): Promise<void> {
  const db = getServerFirebase();
  const docId = generateRiderDocumentId(key);
  
  const docData = {
    ...data,
    updatedAt: new Date().toISOString(),
    key: {
      rider: key.rider,
      year: key.year,
    },
  };

  const cleanedData = cleanFirebaseData(docData) as DocumentData;

  const docRef = db.collection('rider-data').doc(docId);
  const docSnapshot = await docRef.get();
  
  if (docSnapshot.exists) {
    await docRef.update(cleanedData);
    console.log(`[RIDER_SCRAPER_SERVICE] Updated existing rider document: ${docId}`);
  } else {
    await docRef.set(cleanedData);
    console.log(`[RIDER_SCRAPER_SERVICE] Created new rider document: ${docId}`);
  }
}

export async function getRiderData(
  key: RiderDataKey
): Promise<RiderSeasonData | null> {
  const db = getServerFirebase();
  const docId = generateRiderDocumentId(key);
  
  const doc = await db.collection('rider-data').doc(docId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  if (!data) {
    return null;
  }
  
  const { updatedAt, key: docKey, ...riderData } = data;
  return riderData as RiderSeasonData;
}

export async function scrapeRiderData(riderNameId: string, year: number): Promise<RiderSeasonData> {
  console.log(`[RIDER_SCRAPER] Starting scrape for rider: ${riderNameId}, year: ${year}`);
  
  const url = `https://www.procyclingstats.com/rider/${riderNameId}`;
  
  // Use browserHelper for automatic Vercel/local environment detection
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[RIDER_SCRAPER] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 30000 });

    const html = await page.content();
    
    // Parse the rider results table
    const results = parseRiderResultsTable(html, year);
    
    // Calculate totals
    const totalPcsPoints = results.reduce((sum, result) => sum + (result.pcsPoints || 0), 0);
    const totalUciPoints = results.reduce((sum, result) => sum + (result.uciPoints || 0), 0);
    const totalDistance = results.reduce((sum, result) => {
      if (result.distance) {
        const dist = parseFloat(result.distance.replace(/[^\d.]/g, ''));
        return sum + (isNaN(dist) ? 0 : dist);
      }
      return 0;
    }, 0);
    
    // Extract unique dates to count racing days
    const uniqueDates = new Set(results.map(r => r.date).filter(Boolean));
    const totalDays = uniqueDates.size;
    
    const riderData: RiderSeasonData = {
      nameID: riderNameId,
      name: extractRiderName(html) || riderNameId,
      year,
      results,
      totalPcsPoints,
      totalUciPoints,
      totalDistance,
      totalDays,
      scrapedAt: new Date().toISOString(),
    };
    
    console.log(`[RIDER_SCRAPER] Successfully scraped ${riderNameId}: ${results.length} results, ${totalPcsPoints} PCS points`);
    
    return riderData;
    
  } catch (error) {
    console.error(`[RIDER_SCRAPER] Error scraping ${riderNameId}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

function parseRiderResultsTable(html: string, year: number): RiderResult[] {
  const results: RiderResult[] = [];
  
  const $ = cheerio.load(html);
  
  // Find the results table
  const resultsTable = $('#rdrResultCont table');
  if (resultsTable.length === 0) {
    console.log('[RIDER_SCRAPER] No results table found');
    return results;
  }
  
  let currentMainRace: Partial<RiderResult> = {};
  
  // Process each row in the table
  resultsTable.find('tr').each((_, element) => {
    const $row = $(element);
    const rowClass = $row.attr('class') || '';
    
    if (rowClass.includes('main')) {
      // Parse main race row
      currentMainRace = parseMainRaceRow($row, year);
    } else if (rowClass.includes('stage') && currentMainRace.race) {
      // Parse stage row and combine with main race info
      const stageResult = parseStageRow($row, currentMainRace);
      if (stageResult) {
        results.push(stageResult);
      }
    }
  });
  
  return results;
}

function parseMainRaceRow($row: cheerio.Cheerio<any>, year: number): Partial<RiderResult> {
  const $cells = $row.find('td');
  
  if ($cells.length < 5) return {};
  
  // Extract date from first cell
  const dateText = $cells.eq(0).text().trim();
  const date = extractDate(dateText, year);
  
  // Extract race info from 5th cell (index 4)
  const $raceCell = $cells.eq(4);
  const $raceLink = $raceCell.find('a');
  
  if ($raceLink.length === 0) return {};
  
  const raceUrl = `https://www.procyclingstats.com${$raceLink.attr('href') || ''}`;
  const race = $raceLink.text().replace(/\s*\([^)]*\)/g, '').trim(); // Remove (2.UWT) etc.
  
  // Extract flag
  const $flag = $raceCell.find('.flag');
  const flag = $flag.length > 0 ? $flag.attr('class')?.split(' ').pop() : undefined;
  
  return {
    date,
    race,
    raceUrl,
    flag,
    isMainRace: true,
  };
}

function parseStageRow($row: cheerio.Cheerio<any>, mainRace: Partial<RiderResult>): RiderResult | null {
  const $cells = $row.find('td');
  
  if ($cells.length < 8) return null;
  
  // Extract date from first cell
  const date = $cells.eq(0).text().trim();
  
  // Extract position from second cell
  const positionText = $cells.eq(1).text().trim();
  const position = positionText === 'DNF' ? undefined : parseInt(positionText);
  
  // Extract stage info from 5th cell (index 4)
  const $stageCell = $cells.eq(4);
  const $stageLink = $stageCell.find('a');
  
  if ($stageLink.length === 0) return null;
  
  const stageUrl = `https://www.procyclingstats.com${$stageLink.attr('href') || ''}`;
  const stageText = $stageLink.html() || '';
  
  // Extract stage number and name
  const $stageNumber = $stageLink.find('.imob');
  const $stageName = $stageLink.find('.idesk');
  
  let stageNumber: string | undefined;
  let stageName: string | undefined;
  
  if ($stageNumber.length > 0 && $stageName.length > 0) {
    stageNumber = $stageNumber.text();
    stageName = $stageName.text();
  } else {
    stageName = $stageLink.text();
  }
  
  // Extract distance from 6th cell (index 5)
  const distanceText = $cells.eq(5).text().trim();
  const distance = distanceText || undefined;
  
  // Extract PCS points from 7th cell (index 6)
  const pcsPointsText = $cells.eq(6).text().trim();
  const pcsPoints = pcsPointsText && pcsPointsText !== '-' ? parseInt(pcsPointsText) : undefined;
  
  // Extract UCI points from 8th cell (index 7)
  const uciPointsText = $cells.eq(7).text().trim();
  let uciPoints: number | undefined;
  
  if (uciPointsText) {
    // Handle cases like "60 +10" where +10 is GC bonus
    const uciMatch = uciPointsText.match(/^(\d+)/);
    if (uciMatch) {
      uciPoints = parseInt(uciMatch[1]);
    }
  }
  
  return {
    date,
    position,
    race: mainRace.race || '',
    raceUrl: mainRace.raceUrl || '',
    flag: mainRace.flag,
    distance,
    pcsPoints,
    uciPoints,
    stageNumber,
    stageName,
    isMainRace: false,
  };
}

function extractDate(dateText: string, year: number): string {
  // Handle formats like "20.01 › 25.01" or "20-25/1"
  const match = dateText.match(/(\d{2})\.(\d{2})|(\d{2})-(\d{2})\/(\d)/);
  if (match) {
    if (match[1] && match[2]) {
      // Format "20.01 › 25.01" - take first date
      return `${year}-${match[2]}-${match[1].padStart(2, '0')}`;
    } else if (match[3] && match[4] && match[5]) {
      // Format "20-25/1" - take first date
      return `${year}-${match[5].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
    }
  }
  
  // Handle single date format like "22.01" or "11.01"
  const singleMatch = dateText.match(/(\d{2})\.(\d{2})/);
  if (singleMatch) {
    return `${year}-${singleMatch[2]}-${singleMatch[1].padStart(2, '0')}`;
  }
  
  return dateText;
}

function extractRiderName(html: string): string | null {
  // Try to extract rider name from page title or header
  const titleMatch = html.match(/<title>([^<]*) - ProCyclingStats<\/title>/);
  if (titleMatch) {
    return titleMatch[1].trim();
  }
  
  // Fallback to h1
  const h1Match = html.match(/<h1[^>]*>([^<]*)<\/h1>/);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  return null;
}
