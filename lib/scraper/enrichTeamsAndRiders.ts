import * as cheerio from 'cheerio';
import { EnrichedRider, Rider } from './types';

export async function enrichTeamsAndRiders({ year, team }: { year: number, team: string  }) {

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

        return {
            riders,
            name: $('title').text().trim(),
            country: $('.title > .flag').attr('class')?.split(' ')[1] || '',
            points: Number($('.list.horizontal.teamkpi li:nth-child(2)').find('div.value a').text().trim()),
            pcsRank: Number($('.list.horizontal.teamkpi li:nth-child(3)').find('div.value a').text().trim() || 0),
            uciRank: Number($('.list.horizontal.teamkpi li:nth-child(4)').find('div.value a').text().trim() || 0),
            team,
            year,
            jerseyImageTeam,
        };
    } catch (error) {
        console.error('Error in enrichTeamsAndRiders:', error);
        throw error;
    }
}
