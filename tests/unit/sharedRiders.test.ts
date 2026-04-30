import { describe, expect, it } from 'vitest';
import { getSharedRiderRules } from '@/lib/auction/sharedRiders';

describe('getSharedRiderRules', () => {
  it('allows two owners for Giro Auction Master division 1', () => {
    const rules = getSharedRiderRules({
      gameType: 'auctioneer',
      divisionLevel: 1,
      raceRef: 'races/giro-d-italia_2026',
    });

    expect(rules).toEqual({
      allowSharedRiders: true,
      maxOwnersPerRider: 2,
    });
  });

  it('keeps single-owner logic for non-Giro Auction Master division 1', () => {
    const rules = getSharedRiderRules({
      gameType: 'auctioneer',
      divisionLevel: 1,
      raceRef: 'races/tour-de-france_2026',
    });

    expect(rules).toEqual({
      allowSharedRiders: false,
      maxOwnersPerRider: 1,
    });
  });

  it('keeps single-owner logic for Giro Auction Master division 2', () => {
    const rules = getSharedRiderRules({
      gameType: 'auctioneer',
      divisionLevel: 2,
      raceRef: 'races/giro-d-italia_2026',
    });

    expect(rules).toEqual({
      allowSharedRiders: false,
      maxOwnersPerRider: 1,
    });
  });
});
