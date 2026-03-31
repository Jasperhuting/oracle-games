import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { createHash } from 'node:crypto';
import { getServerFirebase } from '@/lib/firebase/server';

const DEFAULT_CALENDAR_ID = 'primary';
const SOURCE_LABEL = 'oracle-games-race-sync';
const APP_TIME_ZONE = 'Europe/Amsterdam';
const SYNC_CONCURRENCY = 3;
const MAX_RETRIES = 4;
const WOMEN_CLASSIFICATIONS = new Set(['1.WWT', '2.WWT', '1.WE', '2.WE', 'WE', 'WWT']);
const WOMEN_KEYWORDS = ['women', 'woman', 'ladies', 'dames', 'femmes', 'feminin', 'féminin'];

type SyncStatus = 'created' | 'updated' | 'unchanged' | 'deleted' | 'failed';

export interface GoogleCalendarRaceSyncResult {
  enabled: boolean;
  skipped?: boolean;
  reason?: string;
  year: number;
  calendarId?: string;
  hasMore?: boolean;
  nextCursor?: string | null;
  limit?: number;
  created: number;
  updated: number;
  unchanged: number;
  deleted: number;
  failed: number;
  total: number;
  results: Array<{
    raceId: string;
    eventId?: string;
    status: SyncStatus;
    error?: string;
    calendarId?: string;
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

interface SyncOptions {
  limit?: number;
  cursor?: string | null;
}

const DEFAULT_SYNC_LIMIT = 120;
const MAX_SYNC_LIMIT = 200;

function getConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || DEFAULT_CALENDAR_ID;
  const classificationCalendarMap = parseClassificationCalendarMap(process.env.GOOGLE_CALENDAR_CLASS_MAP);

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
    classificationCalendarMap,
  };
}

function parseClassificationCalendarMap(rawValue: string | undefined): Record<string, string> {
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return Object.fromEntries(
      Object.entries(parsed)
        .filter(([, value]) => typeof value === 'string' && value.trim())
        .map(([key, value]) => [key.trim(), String(value).trim()]),
    );
  } catch (error) {
    throw new Error(
      `Invalid GOOGLE_CALENDAR_CLASS_MAP JSON: ${error instanceof Error ? error.message : 'Unknown parse error'}`,
    );
  }
}

function getTargetCalendarId(
  race: Pick<RaceRecord, 'classification'>,
  config: { calendarId: string; classificationCalendarMap: Record<string, string> },
): string {
  const classification = race.classification?.trim();
  if (classification && config.classificationCalendarMap[classification]) {
    return config.classificationCalendarMap[classification];
  }

  return config.calendarId;
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function getTodayInAmsterdam(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function isPastRace(race: Pick<RaceRecord, 'startDate' | 'endDate'>, today: string): boolean {
  const endDate = race.endDate || race.startDate;
  return endDate < today;
}

function isWomenRace(race: Pick<RaceRecord, 'name' | 'slug' | 'classification'>): boolean {
  const classification = race.classification?.trim().toUpperCase() || '';
  if (WOMEN_CLASSIFICATIONS.has(classification)) {
    return true;
  }

  const haystack = `${race.name || ''} ${race.slug || ''}`.toLowerCase();
  if (WOMEN_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return true;
  }

  return /(^|[-_\s])we($|[-_\s\d])/.test(haystack);
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

function buildGoogleEventId(race: Pick<RaceRecord, 'id'>): string {
  const digest = createHash('md5').update(race.id).digest('hex');
  return `oracle${digest}`;
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

function isConflictGoogleEvent(error: unknown): boolean {
  const status = (error as { code?: number; status?: number; response?: { status?: number } })?.code
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.status
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.response?.status;

  return status === 409;
}

function isRateLimitError(error: unknown): boolean {
  const status = (error as { code?: number; status?: number; response?: { status?: number } })?.code
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.status
    ?? (error as { code?: number; status?: number; response?: { status?: number } })?.response?.status;

  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return status === 403 || status === 429 || message.includes('rate limit exceeded');
}

function formatGoogleCalendarError(error: unknown, calendarId?: string): string {
  if (isMissingGoogleEvent(error) && calendarId && calendarId !== DEFAULT_CALENDAR_ID) {
    return `Calendar not found or not shared with this Google account: ${calendarId}`;
  }

  return error instanceof Error ? error.message : 'Unknown sync error';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withGoogleRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRateLimitError(error) || attempt >= MAX_RETRIES) {
      throw error;
    }

    const delayMs = 500 * (2 ** attempt);
    await sleep(delayMs);
    return withGoogleRetry(fn, attempt + 1);
  }
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function next(): Promise<void> {
    const current = index++;
    if (current >= items.length) {
      return;
    }

    await worker(items[current]);
    await next();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => next()),
  );
}

function getKnownCalendarIds(config: { calendarId: string; classificationCalendarMap: Record<string, string> }): string[] {
  return [...new Set([config.calendarId, ...Object.values(config.classificationCalendarMap)])];
}

async function findRaceEventsInCalendar(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  raceId: string,
): Promise<calendar_v3.Schema$Event[]> {
  const response = await withGoogleRetry(() => calendar.events.list({
    calendarId,
    privateExtendedProperty: [`oracleRaceId=${raceId}`],
    maxResults: 20,
    singleEvents: true,
    showDeleted: false,
  }));

  return response.data.items || [];
}

export async function syncRacesToGoogleCalendar(
  year: number,
  options: SyncOptions = {},
): Promise<GoogleCalendarRaceSyncResult> {
  const client = await getCalendarClient();
  if (!client.config.enabled) {
    return {
      enabled: false,
      skipped: true,
      reason: client.config.reason,
      year,
      hasMore: false,
      nextCursor: null,
      limit: 0,
      created: 0,
      updated: 0,
      unchanged: 0,
      deleted: 0,
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
  const today = getTodayInAmsterdam();
  const knownCalendarIds = getKnownCalendarIds(client.config);
  const requestedLimit = Math.max(1, Math.min(options.limit ?? DEFAULT_SYNC_LIMIT, MAX_SYNC_LIMIT));

  const results: GoogleCalendarRaceSyncResult['results'] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let deleted = 0;
  let failed = 0;

  const futureRaces = races.filter((race) => !isPastRace(race, today) && !isWomenRace(race));
  const syncedRacesToDelete = races.filter((race) =>
    (isPastRace(race, today) || isWomenRace(race)) &&
    race.googleCalendar?.eventId &&
    race.googleCalendar?.syncedCalendarId,
  );

  const workQueue = [
    ...syncedRacesToDelete.map((race) => ({ kind: 'delete' as const, race })),
    ...futureRaces.map((race) => ({ kind: 'upsert' as const, race })),
  ];

  const startIndex = options.cursor
    ? Math.max(0, workQueue.findIndex((item) => item.race.id === options.cursor))
    : 0;
  const queueSlice = workQueue.slice(startIndex, startIndex + requestedLimit);

  await runWithConcurrency(
    queueSlice.filter((item) => item.kind === 'upsert').map((item) => item.race),
    SYNC_CONCURRENCY,
    async (race) => {
    try {
      const targetCalendarId = getTargetCalendarId(race, client.config);
      const resource = buildEventResource(race);
      const expectedEventId = race.googleCalendar?.eventId || buildGoogleEventId(race);

      let event: calendar_v3.Schema$Event | null | undefined;
      let status: SyncStatus;
      let effectiveEventId = expectedEventId;

      for (const calendarId of knownCalendarIds) {
        if (calendarId === targetCalendarId) {
          continue;
        }

        const misplacedEvents = await findRaceEventsInCalendar(client.calendar, calendarId, race.id);
        for (const misplacedEvent of misplacedEvents) {
          if (!misplacedEvent.id) {
            continue;
          }

          try {
            await withGoogleRetry(() => client.calendar.events.delete({
              calendarId,
              eventId: misplacedEvent.id!,
            }));
            deleted++;
          } catch (error) {
            if (!isMissingGoogleEvent(error)) {
              throw error;
            }
          }
        }
      }

      if (
        race.googleCalendar?.eventId &&
        race.googleCalendar?.syncedCalendarId &&
        race.googleCalendar.syncedCalendarId !== targetCalendarId
      ) {
        try {
          await withGoogleRetry(() => client.calendar.events.delete({
            calendarId: race.googleCalendar.syncedCalendarId,
            eventId: race.googleCalendar.eventId,
          }));
        } catch (error) {
          if (!isMissingGoogleEvent(error)) {
            throw error;
          }
        }
      }

      try {
        const insertResponse = await withGoogleRetry(() => client.calendar.events.insert({
          calendarId: targetCalendarId,
          resource: {
            ...resource,
            id: expectedEventId,
          },
        }));
        event = insertResponse.data;
        status = 'created';
        created++;
        effectiveEventId = event?.id || expectedEventId;
      } catch (error) {
        if (!isConflictGoogleEvent(error)) {
          throw error;
        }

        const existing = await withGoogleRetry(() => client.calendar.events.get({
          calendarId: targetCalendarId,
          eventId: expectedEventId,
        }));

        if (eventsMatch(existing.data, resource)) {
          event = existing.data;
          status = 'unchanged';
          unchanged++;
        } else {
          const updateResponse = await withGoogleRetry(() => client.calendar.events.update({
            calendarId: targetCalendarId,
            eventId: expectedEventId,
            resource: {
              ...resource,
              id: expectedEventId,
            },
          }));
          event = updateResponse.data;
          status = 'updated';
          updated++;
        }
      }

      await db.collection('races').doc(race.id).set({
        googleCalendar: {
          eventId: event?.id || effectiveEventId || null,
          eventHtmlLink: event?.htmlLink || null,
          syncedCalendarId: targetCalendarId,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: status,
          lastError: null,
        },
      }, { merge: true });

      results.push({
        raceId: race.id,
        eventId: event?.id || effectiveEventId,
        status,
        calendarId: targetCalendarId,
      });
    } catch (error) {
      failed++;
      const message = formatGoogleCalendarError(error, getTargetCalendarId(race, client.config));
      const targetCalendarId = getTargetCalendarId(race, client.config);

      await db.collection('races').doc(race.id).set({
        googleCalendar: {
          syncedCalendarId: targetCalendarId,
          lastSyncedAt: new Date().toISOString(),
          lastStatus: 'failed',
          lastError: message,
        },
      }, { merge: true });

      results.push({
        raceId: race.id,
        status: 'failed',
        error: message,
        calendarId: targetCalendarId,
      });
    }
  });

  await runWithConcurrency(
    queueSlice.filter((item) => item.kind === 'delete').map((item) => item.race),
    SYNC_CONCURRENCY,
    async (race) => {
    for (const calendarId of knownCalendarIds) {
      const matchingEvents = await findRaceEventsInCalendar(client.calendar, calendarId, race.id);

      for (const matchingEvent of matchingEvents) {
        if (!matchingEvent.id) {
          continue;
        }

        try {
          await withGoogleRetry(() => client.calendar.events.delete({
            calendarId,
            eventId: matchingEvent.id!,
          }));
          deleted++;
        } catch (error) {
          if (!isMissingGoogleEvent(error)) {
            throw error;
          }
        }
      }
    }
    await db.collection('races').doc(race.id).set({
      googleCalendar: {
        eventId: null,
        eventHtmlLink: null,
        syncedCalendarId: null,
        lastSyncedAt: new Date().toISOString(),
        lastStatus: 'deleted',
        lastError: null,
      },
    }, { merge: true });

    results.push({
      raceId: race.id,
      status: 'deleted',
      calendarId: race.googleCalendar!.syncedCalendarId!,
    });
  });

  const nextItem = workQueue[startIndex + queueSlice.length];

  return {
    enabled: true,
    year,
    calendarId: client.config.calendarId,
    hasMore: Boolean(nextItem),
    nextCursor: nextItem?.race.id ?? null,
    limit: requestedLimit,
    created,
    updated,
    unchanged,
    deleted,
    failed,
    total: workQueue.length,
    results,
  };
}

export const __internal = {
  addOneDay,
  buildEventResource,
  buildGoogleEventId,
  eventsMatch,
  getTodayInAmsterdam,
  isPastRace,
  isWomenRace,
  parseClassificationCalendarMap,
  getTargetCalendarId,
};
