import { NextRequest } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';
import { getRacesPuppeteer } from '@/lib/scraper/getRacesPuppeteer';
import { syncRacesToGoogleCalendar } from '@/lib/google-calendar/raceSync';
import { sendTelegramMessage } from '@/lib/telegram';

const TIME_ZONE = 'Europe/Amsterdam';

// Fields that should NOT be overwritten if already set in Firestore
const PROTECTED_FIELDS = ['totalStages', 'hasPrologue', 'isSingleDay', 'excludeFromScraping'];

export async function GET(request: NextRequest) {
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  const authHeader = request.headers.get('authorization');
  const vercelCronHeader = request.headers.get('x-vercel-cron');
  const isAuthorized = (authHeader && authHeader === expectedAuth) || vercelCronHeader === '1';

  if (!isAuthorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const year = new Date().getFullYear();
  return scrapeCalendar(year);
}

export async function scrapeCalendar(year: number): Promise<Response> {
  try {
    const db = getServerFirebase();
    const racesData = await getRacesPuppeteer(year);

    let added = 0;
    let updated = 0;
    let errors = 0;

    for (const race of racesData.races) {
      try {
        const docId = `${race.slug}_${year}`;
        const ref = db.collection('races').doc(docId);

        // Read existing document to avoid overwriting protected fields
        const existing = await ref.get();
        const existingData = existing.data() || {};

        // Build update from only the safe-to-overwrite scraped fields.
        // Do NOT spread the entire race object — if the scraper ever returns
        // a field that collides with a protected name it would silently overwrite it.
        const update: Record<string, unknown> = {
          name: race.name,
          slug: race.slug,
          startDate: race.startDate,
          endDate: race.endDate,
          classification: race.classification,
          country: race.country,
          year,
          updatedAt: new Date().toISOString(),
          scrapedAt: racesData.scrapedAt,
          source: racesData.source,
        };

        // Preserve protected config fields if they are already set in Firestore
        for (const field of PROTECTED_FIELDS) {
          if (existingData[field] != null) {
            update[field] = existingData[field];
          }
        }

        await ref.set(update, { merge: true });

        if (existing.exists) {
          updated++;
        } else {
          added++;
        }
      } catch {
        errors++;
      }
    }

    const googleCalendarSync = await syncRacesToGoogleCalendar(year);

    const message = [
      `📅 <b>Race Calendar Sync</b> (${year})`,
      '',
      `✅ Toegevoegd: ${added}`,
      `🔄 Bijgewerkt: ${updated}`,
      `❌ Fouten: ${errors}`,
      `📋 Totaal gescraped: ${racesData.count}`,
      googleCalendarSync.enabled
        ? `🗓️ Google Calendar: ${googleCalendarSync.created} nieuw, ${googleCalendarSync.updated} aangepast, ${googleCalendarSync.unchanged} ongewijzigd, ${googleCalendarSync.deleted} verwijderd, ${googleCalendarSync.failed} mislukt`
        : `🗓️ Google Calendar: overgeslagen (${googleCalendarSync.reason || 'niet geconfigureerd'})`,
      `⏰ ${new Date().toLocaleString('nl-NL', { timeZone: TIME_ZONE })}`,
    ].join('\n');

    await sendTelegramMessage(message, { parse_mode: 'HTML' });

    return Response.json({
      success: true,
      year,
      added,
      updated,
      errors,
      total: racesData.count,
      googleCalendarSync,
    });
  } catch (error) {
    console.error('[scrape-race-calendar] Error:', error);
    return Response.json(
      { error: 'Calendar scrape failed', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 },
    );
  }
}
