import { describe, expect, it } from 'vitest';
import { rankRiderBids, splitWinningRiderBids } from '@/lib/auction/riderBidRanking';

function makeBid(id: string, userId: string, amount: number, isoDate: string) {
  return {
    id,
    userId,
    amount,
    bidAt: new Date(isoDate),
  };
}

describe('riderBidRanking', () => {
  it('ranks higher bids before lower bids', () => {
    const ranked = rankRiderBids([
      makeBid('b1', 'u1', 10, '2026-04-30T10:00:00.000Z'),
      makeBid('b2', 'u2', 15, '2026-04-30T11:00:00.000Z'),
      makeBid('b3', 'u3', 12, '2026-04-30T12:00:00.000Z'),
    ]);

    expect(ranked.map((bid) => bid.id)).toEqual(['b2', 'b3', 'b1']);
  });

  it('uses oldest bid first when amounts are equal', () => {
    const ranked = rankRiderBids([
      makeBid('b1', 'u1', 20, '2026-04-30T12:00:00.000Z'),
      makeBid('b2', 'u2', 20, '2026-04-30T10:00:00.000Z'),
      makeBid('b3', 'u3', 20, '2026-04-30T11:00:00.000Z'),
    ]);

    expect(ranked.map((bid) => bid.id)).toEqual(['b2', 'b3', 'b1']);
  });

  it('returns top two winners for division 1 style bidding', () => {
    const { winningBids, losingBids } = splitWinningRiderBids([
      makeBid('b1', 'u1', 25, '2026-04-30T12:00:00.000Z'),
      makeBid('b2', 'u2', 30, '2026-04-30T10:00:00.000Z'),
      makeBid('b3', 'u3', 25, '2026-04-30T09:00:00.000Z'),
      makeBid('b4', 'u4', 20, '2026-04-30T08:00:00.000Z'),
    ], 2);

    expect(winningBids.map((bid) => bid.id)).toEqual(['b2', 'b3']);
    expect(losingBids.map((bid) => bid.id)).toEqual(['b1', 'b4']);
  });

  it('returns one winner for division 2 style bidding', () => {
    const { winningBids, losingBids } = splitWinningRiderBids([
      makeBid('b1', 'u1', 25, '2026-04-30T12:00:00.000Z'),
      makeBid('b2', 'u2', 25, '2026-04-30T10:00:00.000Z'),
      makeBid('b3', 'u3', 24, '2026-04-30T09:00:00.000Z'),
    ], 1);

    expect(winningBids.map((bid) => bid.id)).toEqual(['b2']);
    expect(losingBids.map((bid) => bid.id)).toEqual(['b1', 'b3']);
  });
});
