export interface RankedRiderBid {
  id: string;
  userId: string;
  amount: number;
  bidAt: Date | { toDate(): Date };
}

function toDate(value: RankedRiderBid['bidAt']): Date {
  return value instanceof Date ? value : value.toDate();
}

export function rankRiderBids<T extends RankedRiderBid>(bids: T[]): T[] {
  return [...bids].sort((a, b) => {
    if (b.amount !== a.amount) {
      return b.amount - a.amount;
    }

    return toDate(a.bidAt).getTime() - toDate(b.bidAt).getTime();
  });
}

export function splitWinningRiderBids<T extends RankedRiderBid>(bids: T[], winnerCount: number): {
  winningBids: T[];
  losingBids: T[];
} {
  const rankedBids = rankRiderBids(bids);
  return {
    winningBids: rankedBids.slice(0, Math.max(winnerCount, 0)),
    losingBids: rankedBids.slice(Math.max(winnerCount, 0)),
  };
}
