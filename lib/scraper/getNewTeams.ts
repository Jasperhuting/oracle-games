import * as cheerio from 'cheerio';
import { launchBrowser } from './browserHelper';
import { adminDb } from '../firebase/server';

interface Team {
    id: string;
    name: string;
}

export async function getNewTeams() {

    const url = 'https://www.procyclingstats.com/teams.php?s=&year=2026';

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

        // Wait for the teams list to be visible
        console.log('Waiting for teams list to load...');
        await page.waitForSelector('.mt20 ul.list', { timeout: 30000 });

        const html = await page.content();
        const $ = cheerio.load(html);

        const teamsList = $('.mt20 ul.list');
        console.log(`Found ${teamsList.length} team list containers`);

        let teams: Team[] = [];

        // Iterate over each ul.list container
        teamsList.each((_, ul) => {
            // Within each container, iterate over each li element (each is a team)
            $(ul).find('li').each((_, li) => {
                const $li = $(li);
                const link = $li.find('a');
                const name = link.text().trim();
                const href = link.attr('href');
                const id = href?.split('/')[1] || '';

                if (name && id) {
                    teams.push({ name, id });
                }
            });
        });

        console.log(`Parsed ${teams.length} teams`);

        // Save teams to Firestore
        console.log('Saving teams to Firestore...');
        const batch = adminDb.batch();
        let savedCount = 0;

        for (const team of teams) {
            if (team.id && team.name) {
                const teamRef = adminDb.collection('teams').doc(team.id);
                batch.set(teamRef, {
                    name: team.name,
                    slug: team.id
                }, { merge: true });
                savedCount++;
            }
        }

        await batch.commit();
        console.log(`✅ Successfully saved ${savedCount} teams to Firestore`);

        return {
            success: true,
            teams,
            savedCount
        };
    } catch (error) {
        console.error(`\n❌ ERROR in getNewTeams:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}