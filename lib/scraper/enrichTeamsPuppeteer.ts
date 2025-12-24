import * as cheerio from 'cheerio';
import { EnrichedRider, EnrichedTeam } from './types';
import { launchBrowser } from './browserHelper';

export async function enrichTeamsPuppeteer({ year, team }: { year: number, team: string }) {
    const url = `https://www.procyclingstats.com/team/${team}`;

    try {
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

            // Wait for main content to load
            await page.waitForSelector('.title h1', { timeout: 30000 });

            const html = await page.content();
            const $ = cheerio.load(html);

            // Check if we got a "Page not found" response
            const pageTitle = $('title').text().trim();
            if (pageTitle.toLowerCase().includes('page not found') || pageTitle.toLowerCase().includes('404')) {
                console.error(`\n❌ ERROR: Page not found for team "${team}"`);
                console.error(`   URL: ${url}`);
                console.error(`   This team slug may be incorrect or the team may not exist on ProcyclingStats\n`);
                throw new Error(`Page not found for team: ${team}`);
            }

            const jerseyImageTeam = $('.list.infolist.fs14').find('li:nth-child(5) img').attr('src');

            const riders: EnrichedRider[] = [];
            const riderElements = $('.borderbox.w68.left.mb_w100 .photos ul.photos li');

            riderElements.each((_, el) => {
                const riderName = $(el).find('div a').attr('href')?.split('/')[1] || '';
                const riderHref = $(el).find('div a').attr('href') || '';
                const riderAge = $('.riderlistcont .teamlist li').find(`a[href="${riderHref}"]`).closest('li').find('div.w10').last().text().trim();

                const rider: EnrichedRider = {
                    name: riderName,
                    jerseyImage: $(el).find('img').attr('src') || '',
                    age: Number(riderAge),
                };
                riders.push(rider);
            });

            const teamName = $('.title > h1').contents()
                .filter(function() {
                    return this.type === 'text';
                })
                .text()
                .trim();

            const country = $('.title > .flag').attr('class')?.split(' ')[1] || '';
            const teamNameID = team;
            const teamClass = $('.title > h1 > .hideIfMobile').text().replace('(', '').replace(')', '').trim();
            const pointsRaw = $('.list.horizontal.teamkpi li:nth-child(2)').find('div.value a').text().trim();
            const points = Number(pointsRaw);
            const pcsRankRaw = $('.list.horizontal.teamkpi li:nth-child(3)').find('div.value a').text().trim();
            const pcsRank = Number(pcsRankRaw || 0);
            const uciRankRaw = $('.list.horizontal.teamkpi li:nth-child(4)').find('div.value a').text().trim();
            const uciRank = Number(uciRankRaw || 0);

            console.log(`Successfully scraped team ${team} with ${riders.length} riders`);

            // Build result object with only valid enriched data
            const result: EnrichedTeam = {
                teamName: teamName,
                teamNameID: teamNameID,
                year,
                riders: riders,
                jerseyImageTeam: jerseyImageTeam || '',
                pcsRank: pcsRank || 0,
                uciRank: uciRank || 0,
                points: points || 0,
                country: country || '',
                name: teamName || '',
                class: teamClass,
            };

            return result;
        } finally {
            await browser.close();
        }
    } catch (error) {
        console.error(`\n❌ ERROR in enrichTeamsPuppeteer for team "${team}":`, error);
        throw error;
    }
}
