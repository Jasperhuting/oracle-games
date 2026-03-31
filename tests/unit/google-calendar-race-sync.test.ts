import { describe, expect, it } from 'vitest';
import { __internal } from '@/lib/google-calendar/raceSync';

describe('google calendar race sync helpers', () => {
  it('creates an exclusive end date for all-day events', () => {
    expect(__internal.addOneDay('2026-05-10')).toBe('2026-05-11');
    expect(__internal.addOneDay('2026-12-31')).toBe('2027-01-01');
  });

  it('builds a Google Calendar all-day event resource', () => {
    const event = __internal.buildEventResource({
      id: 'tour-of-flanders_2026',
      name: 'Ronde van Vlaanderen',
      slug: 'tour-of-flanders',
      startDate: '2026-04-05',
      endDate: '2026-04-05',
      classification: '1.UWT',
      country: 'Belgium',
      year: 2026,
    });

    expect(event.summary).toBe('Ronde van Vlaanderen');
    expect(event.start?.date).toBe('2026-04-05');
    expect(event.end?.date).toBe('2026-04-06');
    expect(event.extendedProperties?.private?.oracleRaceId).toBe('tour-of-flanders_2026');
  });

  it('builds a deterministic Google event id from the race id', () => {
    expect(__internal.buildGoogleEventId({ id: 'Tour-Down-Under_2026' })).toBe('oracle5ea6086e36c5a28486bba952114a9d0e');
  });

  it('detects when an existing event is already in sync', () => {
    const resource = __internal.buildEventResource({
      id: 'paris-roubaix_2026',
      name: 'Paris-Roubaix',
      slug: 'paris-roubaix',
      startDate: '2026-04-12',
      endDate: '2026-04-12',
      classification: '1.UWT',
      country: 'France',
      year: 2026,
    });

    expect(__internal.eventsMatch(resource, resource)).toBe(true);
    expect(
      __internal.eventsMatch(
        resource,
        { ...resource, summary: 'Paris-Roubaix Femmes' },
      ),
    ).toBe(false);
  });

  it('parses a classification to calendar mapping from JSON', () => {
    expect(
      __internal.parseClassificationCalendarMap('{"1.UWT":"primary","2.UWT":"stage-races@group.calendar.google.com"}'),
    ).toEqual({
      '1.UWT': 'primary',
      '2.UWT': 'stage-races@group.calendar.google.com',
    });
  });

  it('selects a mapped calendar based on race classification', () => {
    expect(
      __internal.getTargetCalendarId(
        { classification: '2.UWT' },
        {
          calendarId: 'primary',
          classificationCalendarMap: {
            '1.UWT': 'one-day@group.calendar.google.com',
            '2.UWT': 'stage-races@group.calendar.google.com',
          },
        },
      ),
    ).toBe('stage-races@group.calendar.google.com');

    expect(
      __internal.getTargetCalendarId(
        { classification: '1.Pro' },
        {
          calendarId: 'primary',
          classificationCalendarMap: {
            '1.UWT': 'one-day@group.calendar.google.com',
          },
        },
      ),
    ).toBe('primary');
  });

  it('treats races ending before today as past races', () => {
    expect(
      __internal.isPastRace(
        { startDate: '2026-03-20', endDate: '2026-03-25' },
        '2026-03-31',
      ),
    ).toBe(true);
  });

  it('keeps races ending today or later in sync scope', () => {
    expect(
      __internal.isPastRace(
        { startDate: '2026-03-30', endDate: '2026-03-31' },
        '2026-03-31',
      ),
    ).toBe(false);

    expect(
      __internal.isPastRace(
        { startDate: '2026-04-01', endDate: '2026-04-05' },
        '2026-03-31',
      ),
    ).toBe(false);
  });
});
