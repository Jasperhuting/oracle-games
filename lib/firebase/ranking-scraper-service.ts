import { getServerFirebase } from './server';
import { type DocumentData } from 'firebase-admin/firestore';
import { cleanFirebaseData } from './utils';
import * as cheerio from 'cheerio';
import { launchBrowser } from '../scraper/browserHelper';

export interface RankingRider {
  rank: number;
  name: string;
  nameID: string;
  points: number;
  age?: string;
  country: string;
  team: string;
  teamId?: string;
}

export interface RankingData {
  year: number;
  riders: RankingRider[];
  scrapedAt: string;
}

export async function scrapeSeasonRanking(year: number): Promise<RankingData> {
  console.log(`[RANKING_SCRAPER] Starting scrape for season ranking: ${year}`);
  
  const url = `https://www.procyclingstats.com/rankings/season-individual`;
  
  // Use browserHelper for automatic Vercel/local environment detection
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();

    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`[RANKING_SCRAPER] Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    // Wait for the page to load
    await page.waitForSelector('table', { timeout: 30000 });

    const html = await page.content();
    
    // Parse the ranking table
    const riders = parseRankingTable(html, year);
    
    const rankingData: RankingData = {
      year,
      riders,
      scrapedAt: new Date().toISOString(),
    };
    
    console.log(`[RANKING_SCRAPER] Successfully scraped ${riders.length} riders for ${year}`);
    
    return rankingData;
    
  } catch (error) {
    console.error(`[RANKING_SCRAPER] Error scraping ranking for ${year}:`, error);
    throw error;
  } finally {
    await browser.close();
  }
}

function parseRankingTable(html: string, year: number): RankingRider[] {
  const riders: RankingRider[] = [];
  
  const $ = cheerio.load(html);
  
  // Find the ranking table
  const rankingTable = $('table').first();
  if (rankingTable.length === 0) {
    console.log('[RANKING_SCRAPER] No ranking table found');
    return riders;
  }
  
  // Process each row in the table (skip header)
  rankingTable.find('tr').each((index, element) => {
    if (index === 0) return; // Skip header row
    
    const $row = $(element);
    const $cells = $row.find('td');
    
    if ($cells.length < 5) return;
    
    // Extract rank from first cell
    const rankText = $cells.eq(0).text().trim();
    const rank = parseInt(rankText) || 0;
    
    // Extract rider info from second cell
    const $riderCell = $cells.eq(1);
    const $riderLink = $riderCell.find('a');
    
    if ($riderLink.length === 0) return;
    
    const riderUrl = $riderLink.attr('href') || '';
    const nameID = extractNameIDFromUrl(riderUrl);
    const name = $riderLink.text().trim();
    
    // Extract country flag
    const $flag = $riderCell.find('.flag');
    const country = $flag.length > 0 ? $flag.attr('class')?.split(' ').pop() || '' : '';
    
    // Extract age from third cell
    const ageText = $cells.eq(2).text().trim();
    const age = ageText || undefined;
    
    // Extract team from fourth cell
    const $teamCell = $cells.eq(3);
    const $teamLink = $teamCell.find('a');
    const team = $teamLink.length > 0 ? $teamLink.text().trim() : '';
    const teamUrl = $teamLink.attr('href') || '';
    const teamId = extractTeamIdFromUrl(teamUrl);
    
    // Extract points from fifth cell
    const pointsText = $cells.eq(4).text().trim();
    const points = parseInt(pointsText) || 0;
    
    // ONLY include riders with points > 0
    if (nameID && name && points > 0) {
      riders.push({
        rank,
        name,
        nameID,
        points,
        age,
        country,
        team,
        teamId,
      });
    }
  });
  
  console.log(`[RANKING_SCRAPER] Found ${riders.length} riders with points > 0`);
  return riders;
}

function extractNameIDFromUrl(url: string): string {
  // Extract nameID from URLs like "/rider/tadej-pogacar" or "/rider/jan-michal-jackowiak/2025"
  const match = url.match(/\/rider\/([^\/]+)/);
  return match ? match[1] : '';
}

function extractTeamIdFromUrl(url: string): string {
  // Extract team ID from URLs like "/team/uae-team-emirates" or "/team/uae-team-emirates/2026"
  const match = url.match(/\/team\/([^\/]+)/);
  return match ? match[1] : '';
}

export async function saveRankingData(year: number, data: RankingData): Promise<void> {
  const db = getServerFirebase();
  const docId = `ranking-${year}`;
  
  const docData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };

  const cleanedData = cleanFirebaseData(docData) as DocumentData;

  const docRef = db.collection('seasonRankings').doc(docId);
  const docSnapshot = await docRef.get();
  
  if (docSnapshot.exists) {
    await docRef.update(cleanedData);
    console.log(`[RANKING_SCRAPER] Updated existing ranking document: ${docId}`);
  } else {
    await docRef.set(cleanedData);
    console.log(`[RANKING_SCRAPER] Created new ranking document: ${docId}`);
  }
}

export async function getRankingData(year: number): Promise<RankingData | null> {
  const db = getServerFirebase();
  const docId = `ranking-${year}`;
  
  const doc = await db.collection('seasonRankings').doc(docId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data();
  if (!data) {
    return null;
  }
  
  const { updatedAt, ...rankingData } = data;
  return rankingData as RankingData;
}
