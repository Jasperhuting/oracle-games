import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import { createHash } from 'node:crypto';
import { GROUP_STAGE_FIXTURES } from '@/lib/wk-2026/group-stage-fixtures';
import { KNOCKOUT_MATCHES } from '@/lib/types/knockout';

const SOURCE_LABEL = 'oracle-games-wk-2026-sync';
const APP_TIME_ZONE = 'Europe/Amsterdam';
const SYNC_CONCURRENCY = 3;
const MAX_RETRIES = 4;

const ROUND_LABELS: Record<string, string> = {
  round_of_32: 'Laatste 32',
  round_of_16: 'Achtste finales',
  quarterfinals: 'Kwartfinales',
  semifinals: 'Halve finales',
  third_place: 'Troostfinale',
  final: 'Finale',
};

type SyncStatus = 'created' | 'updated' | 'unchanged' | 'failed';

export interface WkCalendarSyncResult {
  enabled: boolean;
  skipped?: boolean;
  reason?: string;
  calendarId?: string;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  total: number;
  results: Array<{
    matchId: string;
    matchNumber: number;
    eventId?: string;
    status: SyncStatus;
    error?: string;
  }>;
}

interface WkFixtureItem {
  matchNumber: number;
  type: 'group' | 'knockout';
  summary: string;
  description: string;
  date: string;
  time?: string; // HH:MM CEST, undefined means all-day
  stadium: string;
  city: string;
}

function getConfig() {
  const clientId = process.env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_CALENDAR_REFRESH_TOKEN;
  const calendarId = process.env.WK_2026_GOOGLE_CALENDAR_ID;

  if (!clientId || !clientSecret || !refreshToken) {
    return {
      enabled: false as const,
      reason: 'Missing GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET, or GOOGLE_CALENDAR_REFRESH_TOKEN',
    };
  }

  if (!calendarId) {
    return {
      enabled: false as const,
      reason: 'Missing WK_2026_GOOGLE_CALENDAR_ID',
    };
  }

  return { enabled: true as const, clientId, clientSecret, refreshToken, calendarId };
}

function addOneDay(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
  const [h, m] = time.split(':').map(Number);
  const totalMinutes = h * 60 + m + minutes;
  const extraDays = Math.floor(totalMinutes / (24 * 60));
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;

  let endDate = date;
  if (extraDays > 0) {
    const d = new Date(`${date}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() + extraDays);
    endDate = d.toISOString().slice(0, 10);
  }

  return { date: endDate, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

function buildGroupSummary(fixture: typeof GROUP_STAGE_FIXTURES[number]): string {
  return `WK 2026 | ${fixture.team1Name} - ${fixture.team2Name} (Groep ${fixture.group.toUpperCase()})`;
}

function buildKnockoutSummary(match: typeof KNOCKOUT_MATCHES[number]): string {
  const round = ROUND_LABELS[match.round] ?? match.round;
  return `WK 2026 | ${round} - wedstrijd ${match.matchNumber}`;
}

function buildEventResource(fixture: WkFixtureItem): calendar_v3.Schema$Event {
  const details = [
    `Stadium: ${fixture.stadium}`,
    `Stad: ${fixture.city}`,
    `Type: ${fixture.type === 'group' ? 'Groepsfase' : 'Knock-out'}`,
    `Wedstrijd #${fixture.matchNumber}`,
    `Source: ${SOURCE_LABEL}`,
  ];

  const startEnd: Pick<calendar_v3.Schema$Event, 'start' | 'end'> =
    fixture.time && fixture.time !== '00:00'
      ? (() => {
          const end = addMinutes(fixture.date, fixture.time, 105);
          return {
            start: { dateTime: `${fixture.date}T${fixture.time}:00`, timeZone: APP_TIME_ZONE },
            end: { dateTime: `${end.date}T${end.time}:00`, timeZone: APP_TIME_ZONE },
          };
        })()
      : {
          start: { date: fixture.date },
          end: { date: addOneDay(fixture.date) },
        };

  return {
    summary: fixture.summary,
    description: details.join('\n'),
    location: `${fixture.stadium}, ${fixture.city}`,
    ...startEnd,
    extendedProperties: {
      private: {
        oracleWkMatchNumber: String(fixture.matchNumber),
        oracleWkType: fixture.type,
        source: SOURCE_LABEL,
      },
    },
  };
}

function buildEventId(matchNumber: number): string {
  const digest = createHash('md5').update(`wk2026-match-${matchNumber}`).digest('hex');
  return `oracle${digest}`;
}

function eventsMatch(
  existing: calendar_v3.Schema$Event | undefined,
  next: calendar_v3.Schema$Event,
): boolean {
  return (
    existing?.summary === next.summary &&
    existing?.description === next.description &&
    existing?.location === next.location &&
    existing?.start?.date === next.start?.date &&
    existing?.start?.dateTime === next.start?.dateTime &&
    existing?.end?.date === next.end?.date &&
    existing?.end?.dateTime === next.end?.dateTime
  );
}

function isConflict(error: unknown): boolean {
  const status =
    (error as { code?: number })?.code ??
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status;
  return status === 409;
}

function isMissing(error: unknown): boolean {
  const status =
    (error as { code?: number })?.code ??
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 410;
}

function isRateLimit(error: unknown): boolean {
  const status =
    (error as { code?: number })?.code ??
    (error as { status?: number })?.status ??
    (error as { response?: { status?: number } })?.response?.status;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return status === 403 || status === 429 || message.includes('rate limit exceeded');
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isRateLimit(error) || attempt >= MAX_RETRIES) throw error;
    await sleep(500 * 2 ** attempt);
    return withRetry(fn, attempt + 1);
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
    if (current >= items.length) return;
    await worker(items[current]);
    await next();
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => next()));
}

function buildAllFixtures(): WkFixtureItem[] {
  const groupItems: WkFixtureItem[] = GROUP_STAGE_FIXTURES.map((f) => ({
    matchNumber: f.matchNumber,
    type: 'group',
    summary: buildGroupSummary(f),
    description: `Groepsfase Groep ${f.group.toUpperCase()}`,
    date: f.date,
    time: f.time,
    stadium: f.stadium,
    city: f.city,
  }));

  const knockoutItems: WkFixtureItem[] = KNOCKOUT_MATCHES.map((m) => ({
    matchNumber: m.matchNumber,
    type: 'knockout',
    summary: buildKnockoutSummary(m),
    description: ROUND_LABELS[m.round] ?? m.round,
    date: m.date,
    time: undefined,
    stadium: m.stadium,
    city: m.location,
  }));

  return [...groupItems, ...knockoutItems].sort((a, b) => a.date.localeCompare(b.date) || a.matchNumber - b.matchNumber);
}

export async function syncWkToGoogleCalendar(): Promise<WkCalendarSyncResult> {
  const config = getConfig();

  if (!config.enabled) {
    return {
      enabled: false,
      skipped: true,
      reason: config.reason,
      created: 0,
      updated: 0,
      unchanged: 0,
      failed: 0,
      total: 0,
      results: [],
    };
  }

  const auth = new google.auth.OAuth2(config.clientId, config.clientSecret);
  auth.setCredentials({ refresh_token: config.refreshToken });
  const calendar = google.calendar({ version: 'v3', auth });

  const fixtures = buildAllFixtures();
  const results: WkCalendarSyncResult['results'] = [];
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let failed = 0;

  await runWithConcurrency(fixtures, SYNC_CONCURRENCY, async (fixture) => {
    const eventId = buildEventId(fixture.matchNumber);
    const resource = buildEventResource(fixture);
    const matchId = `wk2026-match-${fixture.matchNumber}`;

    try {
      try {
        const insertRes = await withRetry(() =>
          calendar.events.insert({
            calendarId: config.calendarId,
            resource: { ...resource, id: eventId },
          }),
        );
        created++;
        results.push({ matchId, matchNumber: fixture.matchNumber, eventId: insertRes.data.id ?? eventId, status: 'created' });
      } catch (error) {
        if (!isConflict(error)) throw error;

        const existing = await withRetry(() =>
          calendar.events.get({ calendarId: config.calendarId, eventId }),
        );

        if (eventsMatch(existing.data, resource)) {
          unchanged++;
          results.push({ matchId, matchNumber: fixture.matchNumber, eventId, status: 'unchanged' });
        } else {
          await withRetry(() =>
            calendar.events.update({
              calendarId: config.calendarId,
              eventId,
              resource: { ...resource, id: eventId },
            }),
          );
          updated++;
          results.push({ matchId, matchNumber: fixture.matchNumber, eventId, status: 'updated' });
        }
      }
    } catch (error) {
      const message = isMissing(error)
        ? `Kalender niet gevonden of niet gedeeld: ${config.calendarId}`
        : error instanceof Error
          ? error.message
          : 'Onbekende fout';
      failed++;
      results.push({ matchId, matchNumber: fixture.matchNumber, status: 'failed', error: message });
    }
  });

  return {
    enabled: true,
    calendarId: config.calendarId,
    created,
    updated,
    unchanged,
    failed,
    total: fixtures.length,
    results: results.sort((a, b) => a.matchNumber - b.matchNumber),
  };
}
