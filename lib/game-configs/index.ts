// lib/game-configs/index.ts
import { z } from 'zod';
import { GAME_TYPES } from '@/lib/types/games';

export * from './shared';
export * from './auctioneer';
export * from './slipstream';
export * from './last-man-standing';
export * from './poisoned-cup';
export * from './nations-cup';
export * from './rising-stars';
export * from './country-roads';
export * from './worldtour-manager';
export * from './fan-flandrien';
export * from './full-grid';
export * from './marginal-gains';
export * from './f1-prediction';

import { auctioneerConfigSchema } from './auctioneer';
import { slipstreamConfigSchema } from './slipstream';
import { lastManStandingConfigSchema } from './last-man-standing';
import { poisonedCupConfigSchema } from './poisoned-cup';
import { nationsCupConfigSchema } from './nations-cup';
import { risingStarsConfigSchema } from './rising-stars';
import { countryRoadsConfigSchema } from './country-roads';
import { worldTourManagerConfigSchema } from './worldtour-manager';
import { fanFlandrienConfigSchema } from './fan-flandrien';
import { fullGridConfigSchema } from './full-grid';
import { marginalGainsConfigSchema } from './marginal-gains';
import { f1PredictionConfigSchema } from './f1-prediction';

/**
 * Lookup map: game type → Zod schema for that game's config.
 * Used in createGameSchema to validate `config` based on the sibling `gameType` field.
 */
export const gameConfigSchemas = {
  'auctioneer': auctioneerConfigSchema,
  'slipstream': slipstreamConfigSchema,
  'last-man-standing': lastManStandingConfigSchema,
  'poisoned-cup': poisonedCupConfigSchema,
  'nations-cup': nationsCupConfigSchema,
  'rising-stars': risingStarsConfigSchema,
  'country-roads': countryRoadsConfigSchema,
  'worldtour-manager': worldTourManagerConfigSchema,
  'fan-flandrien': fanFlandrienConfigSchema,
  'full-grid': fullGridConfigSchema,
  'marginal-gains': marginalGainsConfigSchema,
  'f1-prediction': f1PredictionConfigSchema,
} satisfies Record<typeof GAME_TYPES[number], z.ZodSchema>;

export type GameConfigInput =
  | z.infer<typeof auctioneerConfigSchema>
  | z.infer<typeof slipstreamConfigSchema>
  | z.infer<typeof lastManStandingConfigSchema>
  | z.infer<typeof poisonedCupConfigSchema>
  | z.infer<typeof nationsCupConfigSchema>
  | z.infer<typeof risingStarsConfigSchema>
  | z.infer<typeof countryRoadsConfigSchema>
  | z.infer<typeof worldTourManagerConfigSchema>
  | z.infer<typeof fanFlandrienConfigSchema>
  | z.infer<typeof fullGridConfigSchema>
  | z.infer<typeof marginalGainsConfigSchema>
  | z.infer<typeof f1PredictionConfigSchema>;
