import { z } from 'zod';
import { auctionPeriodSchema, auctionStatusSchema } from './shared';

export const worldTourManagerConfigSchema = z.object({
  budget: z.number().positive(),
  minRiders: z.number().int().positive(),
  maxRiders: z.number().int().positive(),
  minNeoPros: z.number().int().nonnegative().optional(),
  maxNeoProPoints: z.number().nonnegative().optional(),
  maxNeoProAge: z.number().int().positive().optional(),
  auctionPeriods: z.array(auctionPeriodSchema).optional(),
  auctionStatus: auctionStatusSchema.optional(),
});

export type WorldTourManagerConfigInput = z.infer<typeof worldTourManagerConfigSchema>;
