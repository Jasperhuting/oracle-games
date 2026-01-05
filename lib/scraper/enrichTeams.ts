import * as cheerio from 'cheerio';
import { EnrichedRider, EnrichedTeam } from './types';

export async function enrichTeams({ year, team }: { year: number, team: string }) {

    const url = `https://www.procyclingstats.com/team/${team}`;

    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Node Script)' }
        });

        if (!res.ok) {
            throw new Error(`Request failed: ${res.status} ${res.statusText}`);
        }

        const html = await res.text();

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

            const riderAgeText = $('.riderlistcont .teamlist li').find(`a[href="${riderHref}"]`).closest('li').find('div.w10').last().text().trim();

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
                jerseyImage: $(el).find('img').attr('src') || '',
                age: birthDate,
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

        // Build result object with only valid enriched data (don't overwrite with empty/invalid values)
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
    } catch (error) {
        console.error(`\n❌ ERROR in enrichTeams for team "${team}":`, error);
        throw error;
    }
}
