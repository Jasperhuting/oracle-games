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
            
            // Try new structure first: ul.teamlist li in the name tab
            let riderElements = $('.stab.name.riderlistcont ul.teamlist li');
            
            // Fallback to old structure if new one doesn't work
            if (riderElements.length === 0) {
                riderElements = $('.borderbox.w68.left.mb_w100 .photos ul.photos li');
            }

            riderElements.each((_, el) => {
                // New structure: rider link is in .w73 div
                let riderName = $(el).find('.w73 a').attr('href')?.split('/')[1] || '';
                const riderHref = $(el).find('.w73 a').attr('href') || $(el).find('div a').attr('href') || '';
                
                // Fallback to old structure
                if (!riderName) {
                    riderName = $(el).find('div a').attr('href')?.split('/')[1] || '';
                }
                
                // Get age from the .w10 div in the same li (new structure)
                let riderAgeText = $(el).find('div.w10').last().text().trim();
                
                // Fallback: try to find age from the age table
                if (!riderAgeText) {
                    riderAgeText = $('.riderlistcont .teamlist li').find(`a[href="${riderHref}"]`).closest('li').find('div.w10').last().text().trim();
                }

                // Calculate date of birth from age (e.g., "35" -> birth date)
                let birthDate = '';
                const ageNum = parseInt(riderAgeText, 10);
                if (!isNaN(ageNum) && ageNum > 0 && ageNum < 100) {
                    const dob = new Date();
                    dob.setFullYear(dob.getFullYear() - ageNum);
                    birthDate = dob.toISOString().split('T')[0];
                }

                const rider: EnrichedRider = {
                    name: riderName,
                    jerseyImage: '', // Jersey images no longer available in new structure
                    age: birthDate, // Store as birth date in YYYY-MM-DD format
                };
                if (riderName) {
                    riders.push(rider);
                }
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
