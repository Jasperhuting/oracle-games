import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema, countingRaceSchema } from './shared';

export const fullGridConfigSchema = z.object({
  budget: z.number().positive(),
  maxRiders: z.number().int().positive(),
  riderValues: z.record(z.number().nonnegative()),
  selectionStatus: z.enum(['open', 'closed']),
  countingRaces: z.array(z.union([z.string(), countingRaceSchema])).optional(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type FullGridConfigInput = z.infer<typeof fullGridConfigSchema>;
