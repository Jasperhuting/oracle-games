import { describe, it, expect } from 'vitest';
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';
import type { RiderWithBid } from '@/lib/types/pages';
import {
  validateBid,
  type BidValidationContext,
} from '@/lib/bidding/BiddingStrategy';

describe('isProTourTeamClass', () => {
  it('returns true for "prt"', () => {
    expect(isProTourTeamClass('prt')).toBe(true);
  });
  it('returns true for "ProTeam" (case-insensitive)', () => {
    expect(isProTourTeamClass('ProTeam')).toBe(true);
  });
  it('returns true for "pro team" with space', () => {
    expect(isProTourTeamClass('pro team')).toBe(true);
  });
  it('returns true for "protour"', () => {
    expect(isProTourTeamClass('protour')).toBe(true);
  });
  it('returns true for "pro tour"', () => {
    expect(isProTourTeamClass('pro tour')).toBe(true);
  });
  it('returns true for "pro"', () => {
    expect(isProTourTeamClass('pro')).toBe(true);
  });
  it('returns false for "PCT" (continental team)', () => {
    expect(isProTourTeamClass('PCT')).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(isProTourTeamClass(undefined)).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isProTourTeamClass('')).toBe(false);
  });
  it('trims leading/trailing whitespace', () => {
    expect(isProTourTeamClass('  prt  ')).toBe(true);
  });
});

describe('normalizeTeamKey', () => {
  it('strips spaces, pipes, and dashes', () => {
    expect(normalizeTeamKey('Team Visma | Lease a Bike')).toBe('teamvismaleaseabike');
  });
  it('lowercases the result', () => {
    expect(normalizeTeamKey('UAE Team Emirates')).toBe('uaeteamemirates');
  });
  it('handles undefined', () => {
    expect(normalizeTeamKey(undefined)).toBe('');
  });
  it('handles empty string', () => {
    expect(normalizeTeamKey('')).toBe('');
  });
  it('preserves digits', () => {
    expect(normalizeTeamKey('Team 2000')).toBe('team2000');
  });
});

import { buildBiddableRiders, type BuildRidersOptions } from "@/lib/bidding/buildBiddableRiders";
import type { Rider } from "@/lib/types/rider";
import type { Bid } from "@/lib/types";

// Minimal Rider fixture — only the fields we care about
const makeRider = (overrides: Partial<Rider> & { nameID: string; points?: number }): Rider =>
  ({ id: overrides.nameID, name: "Test Rider", ...overrides } as Rider);

// Minimal Bid fixture
const makeBid = (overrides: Partial<Bid> & { riderNameId: string; status: Bid["status"]; amount: number }): Bid =>
  ({ id: "bid-1", userId: "u1", gameId: "g1", playername: "Player", riderName: "Test", riderTeam: "", jerseyImage: "", ...overrides } as Bid);

describe("buildBiddableRiders", () => {
  const baseOpts: BuildRidersOptions = {
    riders: [],
    userBids: [],
    allBids: [],
    soldRidersMap: new Map(),
    gameType: "auctioneer",
  };

  it("sets effectiveMinBid to rider points for auctioneer", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "pogacar", points: 500 })],
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(500);
  });

  it("caps effectiveMinBid at maxMinimumBid", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "pogacar", points: 500 })],
      maxMinimumBid: 300,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(300);
  });

  it("does not cap when points <= maxMinimumBid", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "climber", points: 100 })],
      maxMinimumBid: 300,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(100);
  });

  it("uses riderValues for full-grid instead of points", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: "full-grid",
      riders: [makeRider({ nameID: "evenepoel", points: 400 })],
      riderValues: { evenepoel: 12 },
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(12);
  });

  it("attaches active user bid", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "pogacar", points: 500 })],
      userBids: [makeBid({ riderNameId: "pogacar", status: "active", amount: 600 })],
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].myBid).toBe(600);
    expect(result[0].myBidStatus).toBe("active");
  });

  it("marks rider as sold for auctioneer when in soldRidersMap", () => {
    const sold = new Map([["van-aert", { ownerName: "Alice", pricePaid: 750 }]]);
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: "auctioneer",
      riders: [makeRider({ nameID: "van-aert", points: 700 })],
      soldRidersMap: sold,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].isSold).toBe(true);
    expect(result[0].soldTo).toBe("Alice");
    expect(result[0].pricePaid).toBe(750);
  });

  it("does NOT mark rider as sold for full-grid (selection game)", () => {
    const sold = new Map([["laporte", { ownerName: "Bob", pricePaid: 8 }]]);
    const opts: BuildRidersOptions = {
      ...baseOpts,
      gameType: "full-grid",
      riders: [makeRider({ nameID: "laporte", points: 100 })],
      soldRidersMap: sold,
      riderValues: { laporte: 8 },
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].isSold).toBe(false);
  });

  it("populates highestBid and highestBidder for admins", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "vingegaard", points: 400 })],
      allBids: [
        makeBid({ riderNameId: "vingegaard", status: "active", amount: 500, playername: "Bob" }),
        makeBid({ riderNameId: "vingegaard", status: "active", amount: 700, playername: "Alice" }),
      ],
      isAdmin: true,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].highestBid).toBe(700);
    expect(result[0].highestBidder).toBe("Alice");
  });

  it("does NOT expose highestBidder for non-admins", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "vingegaard", points: 400 })],
      allBids: [
        makeBid({ riderNameId: "vingegaard", status: "active", amount: 700, playername: "Alice" }),
      ],
      isAdmin: false,
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].highestBidder).toBeUndefined();
  });

  it("uses 1 as effectiveMinBid when rider has 0 points (auctioneer)", () => {
    const opts: BuildRidersOptions = {
      ...baseOpts,
      riders: [makeRider({ nameID: "zero-points-rider", points: 0 })],
    };
    const result = buildBiddableRiders(opts);
    expect(result[0].effectiveMinBid).toBe(1);
  });
});

// Minimal RiderWithBid fixture
const makeRiderWithBid = (overrides: Partial<RiderWithBid> & { nameID: string }): RiderWithBid =>
  ({
    id: overrides.nameID,
    name: 'Test Rider',
    points: 100,
    effectiveMinBid: 100,
    isSold: false,
    ...overrides,
  } as RiderWithBid);

// Base validation context — represents a clean state that should pass
const baseCtx: BidValidationContext = {
  rider: makeRiderWithBid({ nameID: 'pogacar' }),
  myBids: [],
  availableRiders: [],
  bidAmount: 150,
  remainingBudget: 10000,
  isUpdatingExistingBid: false,
  isSelectionGame: false,
  isFullGrid: false,
  isTop200Restricted: false,
  maxRiders: undefined,
  proTeamLimit: 4,
  gameType: 'auctioneer',
  config: {},
};

describe('validateBid — sold check', () => {
  it('fails when rider is already sold', () => {
    const ctx = { ...baseCtx, rider: makeRiderWithBid({ nameID: 'sold-rider', isSold: true, soldTo: 'Alice' }) };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('Alice');
  });

  it('passes when rider is not sold', () => {
    expect(validateBid(baseCtx).valid).toBe(true);
  });
});

describe('validateBid — top-200 restriction', () => {
  it('fails when top-200 is active and rider rank is > 200', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: true,
      rider: makeRiderWithBid({ nameID: 'low-rank', rank: 250 }),
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when top-200 is active and rider rank is exactly 200', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: true,
      rider: makeRiderWithBid({ nameID: 'edge-rider', rank: 200 }),
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('passes when top-200 is NOT active regardless of rank', () => {
    const ctx = {
      ...baseCtx,
      isTop200Restricted: false,
      rider: makeRiderWithBid({ nameID: 'low-rank', rank: 999 }),
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — bid amount (non-selection games)', () => {
  it('fails when bid is below effectiveMinBid', () => {
    const ctx = {
      ...baseCtx,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 299,
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when bid equals effectiveMinBid', () => {
    const ctx = {
      ...baseCtx,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 300,
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips amount check for selection games', () => {
    const ctx = {
      ...baseCtx,
      isSelectionGame: true,
      rider: makeRiderWithBid({ nameID: 'pogacar', effectiveMinBid: 300 }),
      bidAmount: 0,
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — team constraint (full-grid)', () => {
  it('fails when user already has a rider from the same team', () => {
    const existingBid = makeBid({ riderNameId: 'other-rider', status: 'active', amount: 8, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: true,
      rider: makeRiderWithBid({ nameID: 'new-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('UAE Team Emirates');
  });

  it('allows selecting the same rider again (updating bid)', () => {
    const existingBid = makeBid({ riderNameId: 'same-rider', status: 'active', amount: 8, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: true,
      rider: makeRiderWithBid({ nameID: 'same-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips team constraint for non-full-grid games', () => {
    const existingBid = makeBid({ riderNameId: 'other-rider', status: 'active', amount: 600, riderTeam: 'UAE Team Emirates' });
    const ctx = {
      ...baseCtx,
      isFullGrid: false,
      rider: makeRiderWithBid({ nameID: 'new-rider', team: { name: 'UAE Team Emirates' } as any }),
      myBids: [existingBid],
    };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — maxRiders limit', () => {
  it('fails when at maxRiders and placing a new bid', () => {
    const bids = [
      makeBid({ riderNameId: 'r1', status: 'active', amount: 8 }),
      makeBid({ riderNameId: 'r2', status: 'active', amount: 8 }),
    ];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 2, isUpdatingExistingBid: false };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('allows updating an existing bid even when at maxRiders', () => {
    const bids = [
      makeBid({ riderNameId: 'r1', status: 'active', amount: 8 }),
      makeBid({ riderNameId: 'r2', status: 'active', amount: 8 }),
    ];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 2, isUpdatingExistingBid: true };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('passes when below maxRiders', () => {
    const bids = [makeBid({ riderNameId: 'r1', status: 'active', amount: 8 })];
    const ctx = { ...baseCtx, myBids: bids, maxRiders: 5, isUpdatingExistingBid: false };
    expect(validateBid(ctx).valid).toBe(true);
  });
});

describe('validateBid — budget', () => {
  it('fails when bid exceeds remaining budget', () => {
    const ctx = { ...baseCtx, bidAmount: 1000, remainingBudget: 500 };
    const result = validateBid(ctx);
    expect(result.valid).toBe(false);
  });

  it('passes when bid equals remaining budget', () => {
    const ctx = { ...baseCtx, bidAmount: 500, remainingBudget: 500 };
    expect(validateBid(ctx).valid).toBe(true);
  });

  it('skips budget check for marginal-gains', () => {
    const ctx = { ...baseCtx, gameType: 'marginal-gains', bidAmount: 9999, remainingBudget: 100 };
    expect(validateBid(ctx).valid).toBe(true);
  });
});
