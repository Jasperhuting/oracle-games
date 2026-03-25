import { describe, it, expect } from 'vitest';
import {
  timestampSchema,
  auctionStatusSchema,
  auctionPeriodSchema,
  countingRaceSchema,
  slipstreamRaceSchema,
} from '@/lib/game-configs/shared';
import {
  auctioneerConfigSchema,
  slipstreamConfigSchema,
  lastManStandingConfigSchema,
  poisonedCupConfigSchema,
  nationsCupConfigSchema,
  risingStarsConfigSchema,
  countryRoadsConfigSchema,
  worldTourManagerConfigSchema,
  fanFlandrienConfigSchema,
  fullGridConfigSchema,
  marginalGainsConfigSchema,
  f1PredictionConfigSchema,
  gameConfigSchemas,
} from '@/lib/game-configs';

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

describe('auctioneerConfigSchema', () => {
  const valid = {
    budget: 500,
    maxRiders: 20,
    auctionPeriods: [],
    auctionStatus: 'pending',
  };
  it('parses valid config', () => {
    expect(() => auctioneerConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects negative budget', () => {
    expect(() => auctioneerConfigSchema.parse({ ...valid, budget: -1 })).toThrow();
  });
  it('rejects missing auctionStatus', () => {
    const { auctionStatus: _, ...rest } = valid;
    expect(() => auctioneerConfigSchema.parse(rest)).toThrow();
  });
});

describe('slipstreamConfigSchema', () => {
  const valid = {
    allowReuse: false,
    countingRaces: [],
    penaltyMinutes: 10,
    pickDeadlineMinutes: 60,
    greenJerseyPoints: { '1': 10, '2': 8 },
  };
  it('parses valid config', () => {
    expect(() => slipstreamConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects allowReuse: true', () => {
    expect(() => slipstreamConfigSchema.parse({ ...valid, allowReuse: true })).toThrow();
  });
  it('rejects negative penaltyMinutes', () => {
    expect(() => slipstreamConfigSchema.parse({ ...valid, penaltyMinutes: -1 })).toThrow();
  });
});

describe('lastManStandingConfigSchema', () => {
  const valid = { budget: 1000, teamSize: 5, eliminationSchedule: 'per-stage' };
  it('parses valid config', () => {
    expect(() => lastManStandingConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid eliminationSchedule', () => {
    expect(() => lastManStandingConfigSchema.parse({ ...valid, eliminationSchedule: 'weekly' })).toThrow();
  });
});

describe('poisonedCupConfigSchema', () => {
  const valid = {
    teamSize: 8,
    budget: 1000,
    draftOrder: ['uid1', 'uid2'],
    currentDraftRound: 1,
    currentDraftPick: 'uid1',
    snakeDraft: true,
  };
  it('parses valid config', () => {
    expect(() => poisonedCupConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing snakeDraft', () => {
    const { snakeDraft: _, ...rest } = valid;
    expect(() => poisonedCupConfigSchema.parse(rest)).toThrow();
  });
});

describe('nationsCupConfigSchema', () => {
  const valid = { regions: ['BE', 'NL', 'FR'] };
  it('parses valid config', () => {
    expect(() => nationsCupConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing regions', () => {
    expect(() => nationsCupConfigSchema.parse({})).toThrow();
  });
});

describe('risingStarsConfigSchema', () => {
  const valid = {
    teamSize: 5,
    draftOrder: ['uid1'],
    currentDraftRound: 0,
    currentDraftPick: 'uid1',
  };
  it('parses valid config', () => {
    expect(() => risingStarsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects non-integer teamSize', () => {
    expect(() => risingStarsConfigSchema.parse({ ...valid, teamSize: 2.5 })).toThrow();
  });
});

describe('countryRoadsConfigSchema', () => {
  const valid = { poolCount: 3, pools: ['pool-a', 'pool-b', 'pool-c'] };
  it('parses valid config', () => {
    expect(() => countryRoadsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects zero poolCount', () => {
    expect(() => countryRoadsConfigSchema.parse({ ...valid, poolCount: 0 })).toThrow();
  });
});

describe('worldTourManagerConfigSchema', () => {
  const valid = { budget: 2000, minRiders: 5, maxRiders: 10 };
  it('parses valid config', () => {
    expect(() => worldTourManagerConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing maxRiders', () => {
    const { maxRiders: _, ...rest } = valid;
    expect(() => worldTourManagerConfigSchema.parse(rest)).toThrow();
  });
});

describe('fanFlandrienConfigSchema', () => {
  const valid = { predictionsPerRace: 3, races: ['roubaix', 'flandres'] };
  it('parses valid config', () => {
    expect(() => fanFlandrienConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects zero predictionsPerRace', () => {
    expect(() => fanFlandrienConfigSchema.parse({ ...valid, predictionsPerRace: 0 })).toThrow();
  });
});

describe('fullGridConfigSchema', () => {
  const valid = {
    budget: 5000,
    maxRiders: 30,
    riderValues: { 'riderA': 100 },
    selectionStatus: 'open',
  };
  it('parses valid config', () => {
    expect(() => fullGridConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects invalid selectionStatus', () => {
    expect(() => fullGridConfigSchema.parse({ ...valid, selectionStatus: 'pending' })).toThrow();
  });
  it('rejects negative riderValue', () => {
    expect(() => fullGridConfigSchema.parse({ ...valid, riderValues: { 'riderA': -1 } })).toThrow();
  });
});

describe('marginalGainsConfigSchema', () => {
  const valid = { teamSize: 6, currentYear: 2026 };
  it('parses valid config', () => {
    expect(() => marginalGainsConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects missing currentYear', () => {
    expect(() => marginalGainsConfigSchema.parse({ teamSize: 6 })).toThrow();
  });
});

describe('f1PredictionConfigSchema', () => {
  const valid = { season: 2026, registrationOpen: true };
  it('parses valid config', () => {
    expect(() => f1PredictionConfigSchema.parse(valid)).not.toThrow();
  });
  it('rejects non-positive season', () => {
    expect(() => f1PredictionConfigSchema.parse({ ...valid, season: 0 })).toThrow();
  });
  it('accepts optional registrationDeadline as ISO string', () => {
    expect(() =>
      f1PredictionConfigSchema.parse({ ...valid, registrationDeadline: '2026-03-01T00:00:00.000Z' })
    ).not.toThrow();
  });
});

describe('gameConfigSchemas', () => {
  it('has an entry for every game type', () => {
    const expectedTypes = [
      'auctioneer', 'slipstream', 'last-man-standing', 'poisoned-cup',
      'nations-cup', 'rising-stars', 'country-roads', 'worldtour-manager',
      'fan-flandrien', 'full-grid', 'marginal-gains', 'f1-prediction',
    ];
    for (const type of expectedTypes) {
      expect(gameConfigSchemas).toHaveProperty(type);
    }
  });
});
