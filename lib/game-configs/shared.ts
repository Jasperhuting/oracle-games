// lib/game-configs/shared.ts
import { z } from 'zod';
import { AUCTION_STATUSES, SLIPSTREAM_RACE_STATUSES } from '@/lib/types/games';

/**
 * Accepts a Firestore Timestamp serialized to JSON ({ seconds, nanoseconds })
 * or an ISO 8601 datetime string. Both representations appear in API JSON payloads.
 */
export const timestampSchema = z.union([
  z.string().datetime(),
  z.object({ seconds: z.number(), nanoseconds: z.number() }),
]);

export const auctionStatusSchema = z.enum(AUCTION_STATUSES);

export const countingRaceSchema = z.object({
  raceId: z.string(),
  raceSlug: z.string(),
  raceName: z.string(),
  pointsScale: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  restDays: z.array(z.number().int()).optional(),
  mountainPointsMultiplier: z.number().positive().optional(),
  sprintPointsMultiplier: z.number().positive().optional(),
});

export const auctionPeriodSchema = z.object({
  name: z.string().min(1),
  startDate: timestampSchema,
  endDate: timestampSchema,
  finalizeDate: timestampSchema.optional(),
  status: auctionStatusSchema,
  top200Only: z.boolean().optional(),
  neoProfsRequired: z.number().int().nonnegative().optional(),
  neoProfsMaxPoints: z.number().nonnegative().optional(),
  neoProfsMaxBudget: z.number().nonnegative().optional(),
});

export const slipstreamRaceSchema = z.object({
  raceId: z.string(),
  raceSlug: z.string(),
  raceName: z.string(),
  raceDate: timestampSchema,
  pickDeadline: timestampSchema,
  hasBonification: z.boolean().optional(),
  status: z.enum(SLIPSTREAM_RACE_STATUSES),
  order: z.number().int().nonnegative(),
});

export type CountingRace = z.infer<typeof countingRaceSchema>;
export type AuctionPeriod = z.infer<typeof auctionPeriodSchema>;
export type SlipstreamRace = z.infer<typeof slipstreamRaceSchema>;
