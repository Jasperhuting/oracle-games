import { describe, it, expect } from 'vitest';
import {
  timestampSchema,
  auctionStatusSchema,
  auctionPeriodSchema,
  countingRaceSchema,
  slipstreamRaceSchema,
} from '@/lib/game-configs/shared';

describe('timestampSchema', () => {
  it('accepts ISO datetime string', () => {
    expect(() => timestampSchema.parse('2026-01-01T00:00:00.000Z')).not.toThrow();
  });
  it('accepts Firestore-serialized object', () => {
    expect(() => timestampSchema.parse({ seconds: 1234567890, nanoseconds: 0 })).not.toThrow();
  });
  it('rejects non-datetime string', () => {
    expect(() => timestampSchema.parse('not-a-date')).toThrow();
  });
  it('rejects plain number', () => {
    expect(() => timestampSchema.parse(1234567890)).toThrow();
  });
});

describe('auctionStatusSchema', () => {
  it('accepts valid statuses', () => {
    for (const s of ['pending', 'active', 'closed', 'finalized']) {
      expect(() => auctionStatusSchema.parse(s)).not.toThrow();
    }
  });
  it('rejects unknown status', () => {
    expect(() => auctionStatusSchema.parse('unknown')).toThrow();
  });
});

describe('auctionPeriodSchema', () => {
  const valid = {
    name: 'Period 1',
    startDate: '2026-01-01T00:00:00.000Z',
    endDate: '2026-01-07T00:00:00.000Z',
    status: 'pending' as const,
  };
  it('parses valid period', () => {
    expect(() => auctionPeriodSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid status', () => {
    expect(() => auctionPeriodSchema.parse({ ...valid, status: 'unknown' })).toThrow();
  });
  it('rejects missing required fields', () => {
    expect(() => auctionPeriodSchema.parse({ name: 'Period 1' })).toThrow();
  });
});

describe('countingRaceSchema', () => {
  const valid = { raceId: 'r1', raceSlug: 'tdf-2026', raceName: 'Tour de France' };
  it('parses valid counting race', () => {
    expect(() => countingRaceSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid pointsScale', () => {
    expect(() => countingRaceSchema.parse({ ...valid, pointsScale: 5 })).toThrow();
  });
  it('rejects missing raceId', () => {
    expect(() => countingRaceSchema.parse({ raceSlug: 'tdf', raceName: 'TdF' })).toThrow();
  });
});

describe('slipstreamRaceSchema', () => {
  const valid = {
    raceId: 'r1',
    raceSlug: 'tdf-2026',
    raceName: 'Tour de France',
    raceDate: '2026-07-01T00:00:00.000Z',
    pickDeadline: '2026-06-30T12:00:00.000Z',
    status: 'upcoming' as const,
    order: 1,
  };
  it('parses valid slipstream race', () => {
    expect(() => slipstreamRaceSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid status', () => {
    expect(() => slipstreamRaceSchema.parse({ ...valid, status: 'invalid' })).toThrow();
  });
  it('rejects missing order', () => {
    const { order: _, ...rest } = valid;
    expect(() => slipstreamRaceSchema.parse(rest)).toThrow();
  });
});
