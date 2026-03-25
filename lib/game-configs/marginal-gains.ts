import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema } from './shared';

export const marginalGainsConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  currentYear: z.number().int().positive(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type MarginalGainsConfigInput = z.infer<typeof marginalGainsConfigSchema>;
