import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema, countingRaceSchema } from './shared';

export const auctioneerConfigSchema = z.object({
  budget: z.number().positive(),
  maxRiders: z.number().int().positive(),
  auctionPeriods: z.array(auctionPeriodSchema),
  auctionStatus: auctionStatusSchema,
  maxMinimumBid: z.number().positive().optional(),
  allowSharedRiders: z.boolean().optional(),
  maxOwnersPerRider: z.number().int().positive().optional(),
  countingRaces: z.array(z.union([z.string(), countingRaceSchema])).optional(),
  countingClassifications: z.array(z.string()).optional(),
});

export type AuctioneerConfigInput = z.infer<typeof auctioneerConfigSchema>;
