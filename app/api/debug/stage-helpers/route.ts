import { NextRequest, NextResponse } from 'next/server';
import { launchBrowser } from '@/lib/scraper/browserHelper';
import * as cheerio from 'cheerio';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const race = searchParams.get('race') || 'tour-down-under';
    const year = searchParams.get('year') || '2026';
    const stage = searchParams.get('stage') || 'prologue';

    console.log('[DEBUG_STAGE_HELPERS] Testing stage helpers...');

    const url = `https://www.procyclingstats.com/race/${race}/${year}/${stage}`;
    const browser = await launchBrowser();

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      console.log(`[DEBUG_STAGE_HELPERS] Navigating to: ${url}`);
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 60000
      });

      await page.waitForSelector('table', { timeout: 30000 });
      const html = await page.content();

      const $ = cheerio.load(html);

      // Test the first rider row
      const firstRow = $('#resultsCont > .resTab tbody > tr').first();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const debugInfo: any = {
        url,
        foundTable: $('#resultsCont > .resTab').length > 0,
        foundRows: $('#resultsCont > .resTab tbody > tr').length,
        firstRowHtml: firstRow.html()?.substring(0, 2000), // Limit size
        tests: {}
      };

      // Test ALL possible selectors for lastName
      debugInfo.tests.lastName = {
        // Current selectors
        'td.ridername .cont a span.uppercase': firstRow.find('td.ridername .cont a span.uppercase').text().trim(),
        'td.ridername a span.uppercase': firstRow.find('td.ridername a span.uppercase').text().trim(),
        'a span.uppercase': firstRow.find('a span.uppercase').text().trim(),
        'td[data-code="ridernamelink"] span.uppercase': firstRow.find('td[data-code="ridernamelink"] span.uppercase').text().trim(),
        // Additional selectors to try
        'span.rider-name': firstRow.find('span.rider-name').text().trim(),
        '.rider span.uppercase': firstRow.find('.rider span.uppercase').text().trim(),
        'td:nth-child(3) span.uppercase': firstRow.find('td:nth-child(3) span.uppercase').text().trim(),
        'td:nth-child(4) span.uppercase': firstRow.find('td:nth-child(4) span.uppercase').text().trim(),
      };

      // Test ALL possible selectors for link/href
      debugInfo.tests.riderLink = {
        'td.ridername .cont a href': firstRow.find('td.ridername .cont a').attr('href') || '',
        'td.ridername a href': firstRow.find('td.ridername a').attr('href') || '',
        'td[data-code="ridernamelink"] a href': firstRow.find('td[data-code="ridernamelink"] a').attr('href') || '',
        'a[href*="rider"] href': firstRow.find('a[href*="rider"]').attr('href') || '',
        '.rider a href': firstRow.find('.rider a').attr('href') || '',
        'td:nth-child(3) a href': firstRow.find('td:nth-child(3) a').attr('href') || '',
        'td:nth-child(4) a href': firstRow.find('td:nth-child(4) a').attr('href') || '',
      };

      // Test link text (full name)
      debugInfo.tests.linkText = {
        'td.ridername .cont a text': firstRow.find('td.ridername .cont a').text().trim(),
        'td.ridername a text': firstRow.find('td.ridername a').text().trim(),
        'td[data-code="ridernamelink"] a text': firstRow.find('td[data-code="ridernamelink"] a').text().trim(),
        'a[href*="rider"] text': firstRow.find('a[href*="rider"]').text().trim(),
        '.rider a text': firstRow.find('.rider a').text().trim(),
      };

      // Test team selectors
      debugInfo.tests.team = {
        'td.cu600': firstRow.find('td.cu600').text().trim(),
        'td[data-code="teamnamelink"]': firstRow.find('td[data-code="teamnamelink"]').text().trim(),
        'td.team a': firstRow.find('td.team a').text().trim(),
        'td.team': firstRow.find('td.team').text().trim(),
        'a[href*="team"]': firstRow.find('a[href*="team"]').text().trim(),
      };

      // Test place selectors
      debugInfo.tests.place = {
        'td:eq(0)': firstRow.find('td').eq(0).text().trim(),
        'td[data-code="rnk"]': firstRow.find('td[data-code="rnk"]').text().trim(),
        'td:first-child': firstRow.find('td:first-child').text().trim(),
      };

      // List all td elements with their classes and text
      debugInfo.allTds = [];
      firstRow.find('td').each((i, td) => {
        debugInfo.allTds.push({
          index: i,
          class: $(td).attr('class') || '',
          dataCode: $(td).attr('data-code') || '',
          text: $(td).text().trim().substring(0, 100),
          hasLink: $(td).find('a').length > 0,
          linkHref: $(td).find('a').attr('href') || '',
        });
      });

      await browser.close();

      return NextResponse.json({
        success: true,
        data: debugInfo,
      });

    } catch (error) {
      await browser.close();
      throw error;
    }

  } catch (error) {
    console.error('[DEBUG_STAGE_HELPERS] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to debug stage helpers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
