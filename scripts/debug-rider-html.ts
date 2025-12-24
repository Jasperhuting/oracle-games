import * as cheerio from 'cheerio';

async function debugRiderPage() {
  const url = 'https://www.procyclingstats.com/rider/titouan-fontaine';

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
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    await page.waitForSelector('h1', { timeout: 30000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    console.log('=== PAGE TITLE ===');
    console.log($('title').text());

    console.log('\n=== H1 TEXT ===');
    console.log($('h1').first().text());

    console.log('\n=== RIDER INFO CONTAINER ===');
    console.log($('.rdr-info-cont').html()?.substring(0, 500));

    console.log('\n=== FLAG CLASSES ===');
    console.log($('.flag').attr('class'));

    console.log('\n=== TEAM LINKS ===');
    $('a[href*="/team/"]').each((i, el) => {
      console.log(`Link ${i}:`, $(el).attr('href'), '|', $(el).text().trim());
    });

    console.log('\n=== QUICK INFO ITEMS ===');
    $('.list.horizontal.rdrquickinfo li').each((i, el) => {
      const title = $(el).find('div:first-child').text().trim();
      const value = $(el).find('div:last-child').text().trim();
      console.log(`Item ${i}: ${title} = ${value}`);
    });

    console.log('\n=== RIDER INFO LIST ===');
    $('.list.circle.rdr-info-list li').each((i, el) => {
      console.log(`Item ${i}:`, $(el).text().trim());
    });

    console.log('\n=== ALL CLASSES CONTAINING "rdr" ===');
    $('[class*="rdr"]').each((i, el) => {
      if (i < 10) {
        console.log(`Element ${i}:`, $(el).attr('class'), '|', $(el).text().trim().substring(0, 50));
      }
    });

    console.log('\n=== ALL DIVS WITH "list" CLASS ===');
    $('div[class*="list"]').each((i, el) => {
      if (i < 10) {
        console.log(`Element ${i}:`, $(el).attr('class'));
      }
    });

    console.log('\n=== SAVE FULL HTML TO FILE ===');
    const fs = await import('fs/promises');
    await fs.writeFile('/tmp/rider-page.html', html);
    console.log('Saved to /tmp/rider-page.html');

  } finally {
    await browser.close();
  }
}

debugRiderPage();
