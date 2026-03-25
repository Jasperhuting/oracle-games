import type { Rider } from "@/lib/types/rider";
import type { Bid } from "@/lib/types";
import type { RiderWithBid } from "@/lib/types/pages";

export interface BuildRidersOptions {
  riders: Rider[];
  /** Bids belonging to the current user. */
  userBids: Bid[];
  /** All bids in the game (used for admin highestBid view). */
  allBids: Bid[];
  /** Map of riderNameId → { ownerName, pricePaid } for sold riders. */
  soldRidersMap: Map<string, { ownerName: string; pricePaid: number }>;
  gameType: string;
  /** Maximum cap on effectiveMinBid for auctioneer games. */
  maxMinimumBid?: number;
  /** Admin-set point values per rider for full-grid games. */
  riderValues?: Record<string, number>;
  /** When true, highest bid amount + bidder name are populated (admin view). */
  isAdmin?: boolean;
}

/**
 * Pure function that enriches a list of Riders with auction metadata.
 * Replaces the two duplicated enrichment paths in auction/page.tsx.
 */
export function buildBiddableRiders(opts: BuildRidersOptions): RiderWithBid[] {
  const {
    riders,
    userBids,
    allBids,
    soldRidersMap,
    gameType,
    maxMinimumBid,
    riderValues,
    isAdmin = false,
  } = opts;

  const isFullGrid = gameType === "full-grid";
  const isBiddingGame = gameType === "auctioneer";

  return riders.map((rider) => {
    const riderNameId = rider.nameID || rider.id || "";

    const myBid = userBids.find(
      (b) => b.riderNameId === rider.nameID || b.riderNameId === rider.id,
    );

    // Sold status only applies to pure-auction game types
    const soldData = soldRidersMap.get(riderNameId);
    const isSold = isBiddingGame && !!soldData;
    const soldTo = soldData?.ownerName;
    const pricePaid = soldData?.pricePaid;

    const effectiveMinBid = computeEffectiveMinBid(riderNameId, rider.points, {
      isFullGrid,
      riderValues,
      maxMinimumBid,
    });

    let highestBid = 0;
    let highestBidder: string | undefined;

    if (isAdmin) {
      const riderBids = allBids.filter(
        (b) =>
          (b.riderNameId === rider.nameID || b.riderNameId === rider.id) &&
          b.status === "active",
      );
      if (riderBids.length > 0) {
        const highest = riderBids.reduce((max, bid) =>
          bid.amount > max.amount ? bid : max,
        );
        highestBid = highest.amount;
        highestBidder = highest.playername || "";
      }
    } else {
      if (
        myBid &&
        (myBid.status === "active" ||
          myBid.status === "outbid" ||
          myBid.status === "won")
      ) {
        highestBid = myBid.amount;
      }
    }

    return {
      ...rider,
      highestBid: highestBid || undefined,
      highestBidder,
      myBid: myBid?.amount || undefined,
      myBidStatus: myBid?.status || undefined,
      myBidId: myBid?.id || undefined,
      effectiveMinBid,
      soldTo,
      isSold,
      pricePaid,
    };
  });
}

function computeEffectiveMinBid(
  riderNameId: string,
  rawPoints: number | undefined,
  opts: {
    isFullGrid: boolean;
    riderValues?: Record<string, number>;
    maxMinimumBid?: number;
  },
): number {
  // Full-grid uses admin-set values
  if (opts.isFullGrid) {
    return (opts.riderValues || {})[riderNameId] || 0;
  }

  // Use `|| 1` to avoid 0 as minimum — mirrors the original page logic
  const points = rawPoints || 1;

  if (opts.maxMinimumBid && points > opts.maxMinimumBid) {
    return opts.maxMinimumBid;
  }

  return points;
}
