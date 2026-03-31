import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { getServerFirebase } from '@/lib/firebase/server';

const DEFAULT_CALENDAR_ID = 'primary';
const SOURCE_LABEL = 'oracle-games-race-sync';

type SyncStatus = 'created' | 'updated' | 'unchanged' | 'failed';

export interface GoogleCalendarRaceSyncResult {
  enabled: boolean;
  skipped?: boolean;
  reason?: string;
  year: number;
  calendarId?: string;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  total: number;
  results: Array<{
    raceId: string;
    eventId?: string;
    status: SyncStatus;
    error?: string;
  }>;
}

interface RaceRecord {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  classification: string;
  country: string;
  year: number;
  googleCalendar?: {
    eventId?: string;
    lastSyncedAt?: string;
    lastStatus?: SyncStatus;
    lastError?: string | null;
    syncedCalendarId?: string;
    eventHtmlLink?: string;
  };
}

function getConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      enabled: false as const,
      reason: 'Missing GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, or GOOGLE_CALENDAR_REFRESH_TOKEN',
    };
  }

  return {
    enabled: true as const,
    clientId,
    clientSecret,
    refreshToken,
    calendarId,
  };
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function buildEventResource(race: RaceRecord): calendar_v3.Schema$Event {
  const details = [
    race.classification ? `Classification: ${race.classification}` : null,
    race.country ? `Country: ${race.country}` : null,
    `Race ID: ${race.id}`,
    `Race slug: ${race.slug}`,
    `Source: ${SOURCE_LABEL}`,
  ].filter(Boolean);

  return {
    summary: race.name,
    description: details.join('\n'),
    start: { date: race.startDate },
    end: { date: addOneDay(race.endDate || race.startDate) },
    extendedProperties: {
      private: {
        oracleRaceId: race.id,
        oracleRaceSlug: race.slug,
        oracleRaceYear: String(race.year),
        source: SOURCE_LABEL,
      },
    },
  };
}

async function getCalendarClient() {
  const config = getConfig();
  if (!config.enabled) {
    return { config };
  }

  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
  auth.setCredentials({ refresh_token: config.refreshToken });

  return {
    config,
    calendar: google.calendar({ version: 'v3', auth }),
  };
}

async function findExistingEventId(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  race: RaceRecord,
): Promise<string | undefined> {
  if (race.googleCalendar?.eventId) {
    return race.googleCalendar.eventId;
  }

  const response = await calendar.events.list({
    calendarId,
    privateExtendedProperty: [`oracleRaceId=${race.id}`],
    maxResults: 1,
    singleEvents: true,
    showDeleted: false,
  });

  return response.data.items?.[0]?.id || undefined;
}

function eventsMatch(
  existing: calendar_v3.Schema$Event | undefined,
  next: calendar_v3.Schema$Event,
): boolean {
  return (
    existing?.summary === next.summary &&
    existing?.description === next.description &&
    existing?.start?.date === next.start?.date &&
    existing?.end?.date === next.end?.date
  );
}

function isMissingGoogleEvent(error: unknown): boolean {
  const status = (error as { code?: number; status?: number; response?: { status?: number } })?.code
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.status
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.response?.status;

  return status === 404 || status === 410;
}

export async function syncRacesToGoogleCalendar(year: number): Promise<GoogleCalendarRaceSyncResult> {
  const client = await getCalendarClient();
  if (!client.config.enabled) {
    return {
      enabled: false,
      skipped: true,
      reason: client.config.reason,
      year,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      total: 0,
      results: [],
    };
  }

  const db = getServerFirebase();
  const racesSnapshot = await db
    .collection('races')
    .where('year', '==', year)
    .get();

  const races = racesSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as RaceRecord))
    .filter((race) => race.name && race.startDate && (race.endDate || race.startDate))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const results: GoogleCalendarRaceSyncResult['results'] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  for (const race of races) {
    try {
      const resource = buildEventResource(race);
      const existingEventId = await findExistingEventId(client.calendar, client.config.calendarId, race);

      let event: calendar_v3.Schema$Event | null | undefined;
      let status: SyncStatus;

      if (existingEventId) {
        try {
          const existing = await client.calendar.events.get({
            calendarId: client.config.calendarId,
            eventId: existingEventId,
          });

          if (eventsMatch(existing.data, resource)) {
            event = existing.data;
            status = 'unchanged';
            unchanged++;
          } else {
            const updateResponse = await client.calendar.events.update({
              calendarId: client.config.calendarId,
              eventId: existingEventId,
              resource,
            });
            event = updateResponse.data;
            status = 'updated';
            updated++;
          }
        } catch (error) {
          if (!isMissingGoogleEvent(error)) {
            throw error;
          }

          const insertResponse = await client.calendar.events.insert({
            calendarId: client.config.calendarId,
            resource,
          });
          event = insertResponse.data;
          status = 'created';
          created++;
        }
      } else {
        const insertResponse = await client.calendar.events.insert({
          calendarId: client.config.calendarId,
          resource,
        });
        event = insertResponse.data;
        status = 'created';
        created++;
      }

      await db.collection('races').doc(race.id).set({
        googleCalendar: {
          eventId: event?.id || existingEventId || null,
          eventHtmlLink: event?.htmlLink || null,
          syncedCalendarId: client.config.calendarId,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: status,
          lastError: null,
        },
      }, { merge: true });

      results.push({
        raceId: race.id,
        eventId: event?.id || existingEventId,
        status,
      });
    } catch (error) {
      failed++;
      const message = error instanceof Error ? error.message : 'Unknown sync error';

      await db.collection('races').doc(race.id).set({
        googleCalendar: {
          syncedCalendarId: client.config.calendarId,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: 'failed',
          lastError: message,
        },
      }, { merge: true });

      results.push({
        raceId: race.id,
        status: 'failed',
        error: message,
      });
    }
  }

  return {
    enabled: true,
    year,
    calendarId: client.config.calendarId,
    created,
    updated,
    unchanged,
    failed,
    total: races.length,
    results,
  };
}

export const __internal = {
  addOneDay,
  buildEventResource,
  eventsMatch,
};
