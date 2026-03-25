import { describe, it, expect } from 'vitest';
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';

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
