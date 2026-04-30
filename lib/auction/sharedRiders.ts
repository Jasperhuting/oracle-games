import type { AuctioneerConfig } from '@/lib/types';

export interface SharedRiderRules {
  allowSharedRiders: boolean;
  maxOwnersPerRider: number;
}

function extractRaceRefPath(raceRef: unknown): string {
  if (!raceRef) return '';
  if (typeof raceRef === 'string') return raceRef;
  if (typeof raceRef === 'object' && raceRef !== null && 'path' in raceRef && typeof (raceRef as { path?: unknown }).path === 'string') {
    return (raceRef as { path: string }).path;
  }
  return '';
}

function isGiroAuctionMasterGame(game: { raceRef?: unknown; name?: unknown }): boolean {
  const raceRefPath = extractRaceRefPath(game.raceRef).toLowerCase();
  if (raceRefPath.includes('giro-d-italia')) {
    return true;
  }

  const name = typeof game.name === 'string' ? game.name.toLowerCase() : '';
  return name.includes('giro') && name.includes('auction');
}

export function getSharedRiderRules(game: { gameType?: unknown; divisionLevel?: number; config?: unknown; raceRef?: unknown; name?: unknown }): SharedRiderRules {
  if (game.gameType !== 'auctioneer') {
    return {
      allowSharedRiders: false,
      maxOwnersPerRider: 1,
    };
  }

  if (game.divisionLevel === 1 && isGiroAuctionMasterGame(game)) {
    return {
      allowSharedRiders: true,
      maxOwnersPerRider: 2,
    };
  }

  if ((game.divisionLevel || 0) >= 2) {
    return {
      allowSharedRiders: false,
      maxOwnersPerRider: 1,
    };
  }

  const config = (game.config || {}) as AuctioneerConfig;
  const allowSharedRiders = Boolean(config.allowSharedRiders);
  const maxOwnersPerRider = allowSharedRiders
    ? Math.max(config.maxOwnersPerRider || Number.MAX_SAFE_INTEGER, 1)
    : 1;

  return {
    allowSharedRiders,
    maxOwnersPerRider,
  };
}
