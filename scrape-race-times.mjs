/**
 * Scrape finish times for all single-day 2026 men's elite races from ProCyclingStats.
 *
 * Run: SCRAPINGBEE_API_KEY=your_key node scrape-race-times.mjs
 * Output: race-times.json
 */

import * as cheerio from 'cheerio';
import { writeFileSync } from 'fs';

const BASE_URL = 'https://www.procyclingstats.com';
const YEAR = 2026;
const API_KEY = process.env.SCRAPINGBEE_API_KEY;

if (!API_KEY) {
  console.error('Missing SCRAPINGBEE_API_KEY env var.\nRun: SCRAPINGBEE_API_KEY=your_key node scrape-race-times.mjs');
  process.exit(1);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function parsePCSDate(dateStr, year) {
  const match = dateStr.match(/(\d{2})\.(\d{2})/);
  if (!match) return '';
  const [, day, month] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

function addMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function sbFetch(url, waitFor = 'table.basic') {
  const apiUrl = new URL('https://app.scrapingbee.com/api/v1/');
  apiUrl.searchParams.set('api_key', API_KEY);
  apiUrl.searchParams.set('url', url);
  apiUrl.searchParams.set('render_js', 'true');
  apiUrl.searchParams.set('premium_proxy', 'true');
  apiUrl.searchParams.set('block_resources', 'true');
  if (waitFor) apiUrl.searchParams.set('wait_for', waitFor);

  const res = await fetch(apiUrl.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ScrapingBee ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.text();
}

// ─── filters ─────────────────────────────────────────────────────────────────

function isWomenRace(race) {
  const cls  = (race.classification || '').toLowerCase();
  const name = (race.name || '').toLowerCase();
  const slug = (race.slug || '').toLowerCase();
  if (cls.includes('wwt')) return true;
  if (/-we-|-wu-|-wu23|-women/.test(slug)) return true;
  if (/women|femmes?|féminin|dames?|femini/.test(name)) return true;
  return false;
}

function isJuniorRace(race) {
  const cls  = (race.classification || '').toLowerCase();
  const name = (race.name || '').toLowerCase();
  const slug = (race.slug || '').toLowerCase();
  if (/-mj-|-wj-|-mj\d|-wj\d/.test(slug)) return true;
  if (/\bjunior(s)?\b/.test(name)) return true;
  if (/[a-z0-9]j\b/.test(cls) || /\bmj\b|\bwj\b/.test(cls)) return true;
  return false;
}

// ─── step 1: get all 2026 races ───────────────────────────────────────────────

async function getRaces() {
  const url = `${BASE_URL}/races.php?s=&year=${YEAR}&circuit=&class=&filter=Filter`;
  console.log(`\n📋  Fetching races list via ScrapingBee...`);

  const html = await sbFetch(url, 'table.basic');
  const $ = cheerio.load(html);
  const races = [];

  $('table.basic tr').each((_, element) => {
    const $row = $(element);
    if ($row.find('th').length > 0 || $row.find('td').length < 5 || $row.hasClass('striked')) return;

    const dateText       = $row.find('td').eq(0).text().trim();
    const raceCell       = $row.find('td').eq(2);
    const raceLink       = raceCell.find('a').first();
    const raceName       = raceLink.text().trim();
    const raceHref       = raceLink.attr('href') || '';
    const classification = $row.find('td').eq(4).text().trim();

    if (!raceName || !raceHref) return;

    const slugMatch = raceHref.match(/\/?race\/([^/]+)/);
    const slug = slugMatch ? slugMatch[1] : '';
    if (!slug) return;

    let startDate = '', endDate = '';
    if (dateText.includes(' - ')) {
      const [start, end] = dateText.split(' - ').map(d => d.trim());
      startDate = parsePCSDate(start, YEAR);
      endDate   = parsePCSDate(end, YEAR);
    } else if (dateText.includes('›')) {
      const [start, end] = dateText.split('›').map(d => d.trim());
      startDate = parsePCSDate(start, YEAR);
      endDate   = parsePCSDate(end, YEAR);
    } else if (dateText) {
      startDate = endDate = parsePCSDate(dateText, YEAR);
    }

    races.push({ slug, name: raceName, startDate, endDate, classification });
  });

  console.log(`   Found ${races.length} races total`);
  return races;
}

// ─── step 2: fetch time-table ────────────────────────────────────────────────

async function getFinishTime(slug) {
  const url = `${BASE_URL}/race/${slug}/2025/result/info/time-table`;
  const html = await sbFetch(url, 'table.basic');

  const $ = cheerio.load(html);
  const table = $('table.basic');
  if (!table.length) return null;

  const rows = table.find('tbody tr');
  if (!rows.length) return null;

  const lastRow = rows.last();
  const cells = lastRow.find('td').map((_, el) => $(el).text().trim()).get();

  const keypoint = cells[1] || '';
  if (!keypoint.toLowerCase().includes('finish')) return null;

  const timeCell = cells.find(c => /^\d{1,2}:\d{2}$/.test(c));
  return timeCell || null;
}

// ─── main ────────────────────────────────────────────────────────────────────

const allRaces = await getRaces();

// ── filter
const singleDay  = allRaces.filter(r => r.startDate && r.endDate && r.startDate === r.endDate);
const multiStage = allRaces.filter(r => r.startDate !== r.endDate || !r.startDate);
const women      = singleDay.filter(r => isWomenRace(r));
const juniors    = singleDay.filter(r => !isWomenRace(r) && isJuniorRace(r));
const stageRaces = singleDay.filter(r => !isWomenRace(r) && !isJuniorRace(r) && r.classification.startsWith('2.'));
const menElite   = singleDay.filter(r => r.classification === '1.UWT');

console.log(`\n🏁  Single-day races: ${singleDay.length}`);
console.log(`   Men's elite (checking): ${menElite.length}`);
console.log(`   Women (skipped):        ${women.length}`);
console.log(`   Juniors (skipped):      ${juniors.length}`);
console.log(`   Stage races 2.x (skipped): ${stageRaces.length}`);
console.log(`🚴  Multi-stage (skipped): ${multiStage.length}`);

// ── build results skeleton with skipped races
const results = {};
for (const race of multiStage) {
  results[race.slug] = { slug: race.slug, name: race.name, skipped: 'multi-stage', startDate: race.startDate, endDate: race.endDate };
}
for (const race of women) {
  results[race.slug] = { slug: race.slug, name: race.name, skipped: 'women', date: race.startDate };
}
for (const race of juniors) {
  results[race.slug] = { slug: race.slug, name: race.name, skipped: 'junior', date: race.startDate };
}
for (const race of stageRaces) {
  results[race.slug] = { slug: race.slug, name: race.name, skipped: 'stage-race-2x', date: race.startDate };
}

// ── fetch time-tables
let found = 0, noTable = 0, errors = 0;
console.log(`\n⏱   Checking time-tables...\n`);

for (let i = 0; i < menElite.length; i++) {
  const race = menElite[i];
  process.stdout.write(`[${i + 1}/${menElite.length}] ${race.slug} ... `);

  try {
    const finishTime = await getFinishTime(race.slug);

    if (finishTime) {
      const scrapeAfter = addMinutes(finishTime, 60);
      console.log(`✓  ${finishTime} → scrape after ${scrapeAfter}`);
      results[race.slug] = {
        slug: race.slug,
        name: race.name,
        date: race.startDate,
        finishTime,
        scrapeAfter,
        url2025: `${BASE_URL}/race/${race.slug}/2025/result/info/time-table`,
      };
      found++;
    } else {
      console.log('no time-table');
      noTable++;
      results[race.slug] = { slug: race.slug, name: race.name, date: race.startDate, noTimeTable: true };
    }
  } catch (err) {
    console.log(`ERROR: ${err.message.split('\n')[0]}`);
    errors++;
    results[race.slug] = { slug: race.slug, name: race.name, date: race.startDate, error: err.message.split('\n')[0] };
  }

  // Small delay to be respectful (ScrapingBee handles rate limiting on their end)
  await delay(300);
}

// ── save
writeFileSync('race-times.json', JSON.stringify(results, null, 2));

console.log('\n────────────────────────────────────────');
console.log(`✅  Done!`);
console.log(`   With time-table:       ${found}`);
console.log(`   No time-table:         ${noTable}`);
console.log(`   Errors:                ${errors}`);
console.log(`   Women (skipped):       ${women.length}`);
console.log(`   Juniors (skipped):     ${juniors.length}`);
console.log(`   Stage 2.x (skipped):   ${stageRaces.length}`);
console.log(`   Multi-stage (skipped): ${multiStage.length}`);
console.log(`   Output → race-times.json`);
