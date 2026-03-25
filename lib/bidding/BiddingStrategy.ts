import type { Bid } from "@/lib/types";
import type { RiderWithBid } from "@/lib/types/pages";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { isProTourTeamClass, normalizeTeamKey } from "./teamUtils";

export type ValidationResult = { valid: true } | { valid: false; error: string };

export interface BidValidationContext {
  rider: RiderWithBid;
  myBids: Bid[];
  availableRiders: RiderWithBid[];
  bidAmount: number;
  remainingBudget: number;
  isUpdatingExistingBid: boolean;
  isSelectionGame: boolean;
  isFullGrid: boolean;
  isTop200Restricted: boolean;
  maxRiders?: number;
  proTeamLimit: number;
  gameType: string;
  config: {
    minRiders?: number;
    maxNeoProPoints?: number;
    maxNeoProAge?: number;
  };
}

/**
 * Runs all applicable validation rules for a bid placement in order.
 * Returns the first failing rule, or { valid: true } if all pass.
 * Pure function — no side effects, no React, no Firestore.
 */
export function validateBid(ctx: BidValidationContext): ValidationResult {
  return (
    checkNotSold(ctx.rider) ??
    checkTop200Restriction(ctx.rider, ctx.isTop200Restricted) ??
    checkBidAmount(ctx.rider, ctx.bidAmount, ctx.isSelectionGame) ??
    checkTeamConstraint(ctx.rider, ctx.myBids, ctx.isFullGrid) ??
    checkProTeamLimit(ctx.rider, ctx.myBids, ctx.availableRiders, ctx.isFullGrid, ctx.proTeamLimit) ??
    checkMaxRiders(ctx.myBids, ctx.maxRiders, ctx.isUpdatingExistingBid) ??
    checkBudget(ctx.bidAmount, ctx.remainingBudget, ctx.gameType) ??
    checkNeoProfRequirement(ctx.rider, ctx.myBids, ctx.availableRiders, ctx.gameType, ctx.config) ?? {
      valid: true,
    }
  );
}

// ---------------------------------------------------------------------------
// Individual rule functions (exported for unit-testing individual rules)
// ---------------------------------------------------------------------------

export function checkNotSold(rider: RiderWithBid): ValidationResult | null {
  if (!rider.isSold) return null;
  return { valid: false, error: `This rider is already sold to ${rider.soldTo}` };
}

export function checkTop200Restriction(
  rider: RiderWithBid,
  isTop200Restricted: boolean,
): ValidationResult | null {
  if (!isTop200Restricted) return null;
  const rank = (rider as any).rank as number | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (typeof rank !== "number" || rank > 200) {
    // Caller must translate this i18n key (cannot call t() in a pure function)
    return { valid: false, error: "messages.top2000OnlyError" };
  }
  return null;
}

export function checkBidAmount(
  rider: RiderWithBid,
  bidAmount: number,
  isSelectionGame: boolean,
): ValidationResult | null {
  if (isSelectionGame) return null;
  const effectiveMinBid = rider.effectiveMinBid ?? 0;
  // Match original order: minimum-bid check first, then zero check
  if (Number(bidAmount) < effectiveMinBid) {
    return { valid: false, error: `Bid must be at least ${effectiveMinBid}` };
  }
  if (!bidAmount || bidAmount <= 0) {
    return { valid: false, error: "Please enter a valid bid amount" };
  }
  return null;
}

export function checkTeamConstraint(
  rider: RiderWithBid,
  myBids: Bid[],
  isFullGrid: boolean,
): ValidationResult | null {
  if (!isFullGrid || !rider.team?.name) return null;
  const riderNameId = rider.nameID || rider.id || "";
  const existingTeamBid = myBids.find(
    (b) =>
      (b.status === "active" || b.status === "won") &&
      b.riderTeam === rider.team!.name &&
      b.riderNameId !== riderNameId,
  );
  if (!existingTeamBid) return null;
  return {
    valid: false,
    error: `Je hebt al een renner van ${rider.team.name} geselecteerd (${existingTeamBid.riderName}). Verwijder eerst die selectie.`,
  };
}

export function checkProTeamLimit(
  rider: RiderWithBid,
  myBids: Bid[],
  availableRiders: RiderWithBid[],
  isFullGrid: boolean,
  proTeamLimit: number,
): ValidationResult | null {
  if (!isFullGrid || !rider.team?.name) return null;

  const teamClass =
    (rider.team as any)?.class || (rider.team as any)?.teamClass; // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!isProTourTeamClass(teamClass)) return null;

  const teamKey = normalizeTeamKey(rider.team.name);

  const selectedProTeams = new Set<string>();
  myBids
    .filter((b) => b.status === "active" || b.status === "won")
    .forEach((b) => {
      const bidRider = availableRiders.find(
        (r) => (r.nameID || r.id) === b.riderNameId,
      );
      const bidTeamName = bidRider?.team?.name || b.riderTeam;
      const bidTeamKey = normalizeTeamKey(bidTeamName);
      const bidTeamClass =
        (bidRider?.team as any)?.class || (bidRider?.team as any)?.teamClass; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (isProTourTeamClass(bidTeamClass) && bidTeamKey) {
        selectedProTeams.add(bidTeamKey);
      }
    });

  if (!selectedProTeams.has(teamKey) && selectedProTeams.size >= proTeamLimit) {
    return {
      valid: false,
      error: `Je mag maximaal ${proTeamLimit} ProTeams selecteren.`,
    };
  }
  return null;
}

export function checkMaxRiders(
  myBids: Bid[],
  maxRiders: number | undefined,
  isUpdatingExistingBid: boolean,
): ValidationResult | null {
  if (!maxRiders || isUpdatingExistingBid) return null;
  const uniqueActive = new Set(
    myBids
      .filter((b) => b.status === "active" || b.status === "outbid")
      .map((b) => b.riderNameId),
  );
  if (uniqueActive.size >= maxRiders) {
    return {
      valid: false,
      error: `Maximum number of riders reached (${uniqueActive.size}/${maxRiders}). Cancel a bid to place a new one.`,
    };
  }
  return null;
}

export function checkBudget(
  bidAmount: number,
  remainingBudget: number,
  gameType: string,
): ValidationResult | null {
  // marginal-gains has no budget constraint
  if (gameType === "marginal-gains") return null;
  if (bidAmount > remainingBudget) {
    return { valid: false, error: "Bid exceeds your remaining budget" };
  }
  return null;
}

export function checkNeoProfRequirement(
  rider: RiderWithBid,
  myBids: Bid[],
  availableRiders: RiderWithBid[],
  gameType: string,
  config: { minRiders?: number; maxNeoProPoints?: number; maxNeoProAge?: number },
): ValidationResult | null {
  if (gameType !== "worldtour-manager" && gameType !== "marginal-gains") return null;

  const minRiders = config.minRiders ?? 27;
  const isThisRiderNeoProf = qualifiesAsNeoProf(rider, config);

  const totalActive = new Set(
    myBids
      .filter((b) => b.status === "active" || b.status === "outbid")
      .map((b) => b.riderNameId),
  ).size;

  const currentNeoProfCount = new Set(
    myBids
      .filter((b) => b.status === "active" || b.status === "outbid")
      .filter((b) => {
        const bidRider = availableRiders.find(
          (r) => (r.nameID || r.id) === b.riderNameId,
        );
        return bidRider && qualifiesAsNeoProf(bidRider, config);
      })
      .map((b) => b.riderNameId),
  ).size;

  if (totalActive >= minRiders && !isThisRiderNeoProf && currentNeoProfCount === 0) {
    const maxAge = config.maxNeoProAge ?? 21;
    const maxPoints = config.maxNeoProPoints ?? 250;
    return {
      valid: false,
      error: `Om meer dan ${minRiders} renners te hebben, moet je minimaal 1 neoprof in je team hebben (max ${maxAge} jaar oud met max ${maxPoints} punten).`,
    };
  }

  if (isThisRiderNeoProf && config.maxNeoProPoints && (rider.points ?? 0) > config.maxNeoProPoints) {
    return {
      valid: false,
      error: `Deze renner heeft te veel punten (${rider.points}) om als neoprof te kwalificeren. Max toegestaan: ${config.maxNeoProPoints} punten.`,
    };
  }

  return null;
}
