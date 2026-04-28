import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';
import type { Element as DomElement } from 'domhandler';
import type { TeamClassification } from '../types';
import { fetchPageHtml } from '../browserHelper';

/**
 * Scrape team stage classification from PCS complementary-results page.
 * URL: /race/{race}/{year}/stage-{stage}/info/complementary-results
 *
 * Used for Giro d'Italia Auction Master team classification points (10-7-5-3-1 per active rider).
 */
export function scrapeComplementaryTeamClassification($: CheerioAPI): TeamClassification[] {
  const results: TeamClassification[] = [];

  const getTeamName = (el: DomElement) =>
    $(el).find('a[href*="team/"]').first().text().trim()
    || $(el).find('.teamname').text().trim()
    || '';

  const getShortName = (el: DomElement) => {
    const href = $(el).find('a[href*="team/"]').first().attr('href') || '';
    const parts = href.split('/').filter(Boolean);
    return (parts[parts.length - 1] || '').replace(/-\d{4}$/, '');
  };

  // Try table selectors (most common on PCS result pages)
  let rows = $('table.result tbody tr, table.basic tbody tr');

  if (rows.length === 0) {
    rows = $('.general tbody tr');
  }

  if (rows.length === 0) {
    rows = $('table tbody tr').filter((_, el) => $(el).find('a[href*="team/"]').length > 0);
  }

  if (rows.length > 0) {
    rows.each((_, el) => {
      const place = parseInt($(el).find('td').eq(0).text().trim(), 10);
      if (!place || isNaN(place)) return;
      const team = getTeamName(el as DomElement);
      const shortName = getShortName(el as DomElement);
      if (team) results.push({ place, team, shortName, class: '' });
    });

    console.log(`[complementaryTeam] Found ${results.length} teams via table selector`);
    if (results.length > 0) {
      console.log(`[complementaryTeam] Top 3:`, results.slice(0, 3).map(r => `${r.place}. ${r.team}`));
    }
    return results;
  }

  // Fallback: list items (PCS sometimes uses ul/li for info pages)
  const listItems = $('ul.list > li, .resultsList li').filter((_, el) =>
    $(el).find('a[href*="team/"]').length > 0
  );

  listItems.each((idx, el) => {
    const rankText = $(el).find('.rnk, .rank').first().text().trim()
      || $(el).find('span').first().text().trim();
    const rank = parseInt(rankText, 10) || idx + 1;
    const team = $(el).find('a[href*="team/"]').first().text().trim();
    const href = $(el).find('a[href*="team/"]').first().attr('href') || '';
    const parts = href.split('/').filter(Boolean);
    const shortName = (parts[parts.length - 1] || '').replace(/-\d{4}$/, '');
    if (team) results.push({ place: rank, team, shortName, class: '' });
  });

  console.log(`[complementaryTeam] Found ${results.length} teams via list selector`);
  if (results.length > 0) {
    console.log(`[complementaryTeam] Top 3:`, results.slice(0, 3).map(r => `${r.place}. ${r.team}`));
  } else {
    console.warn('[complementaryTeam] No teams found — page structure may have changed');
  }

  return results;
}

export async function fetchComplementaryTeamClassification(
  race: string,
  year: number,
  stage: number
): Promise<TeamClassification[]> {
  const url = `https://www.procyclingstats.com/race/${race}/${year}/stage-${stage}/info/complementary-results`;

  try {
    const html = await fetchPageHtml({
      url,
      selectors: ['table', '.general', 'ul.list', '.page-content'],
      noDataTexts: ['No results available', 'Not started'],
      noDataErrorMessage: `No complementary team results for ${race} ${year} stage ${stage}`,
      logLabel: 'complementaryTeam',
    });

    const $ = cheerio.load(html);
    return scrapeComplementaryTeamClassification($);
  } catch (error) {
    console.warn(
      `[complementaryTeam] Failed to fetch stage ${stage}:`,
      error instanceof Error ? error.message : String(error)
    );
    return [];
  }
}
