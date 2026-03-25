import { z } from 'zod';

export const risingStarsConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  draftOrder: z.array(z.string()),
  currentDraftRound: z.number().int().nonnegative(),
  currentDraftPick: z.string(),
});

export type RisingStarsConfigInput = z.infer<typeof risingStarsConfigSchema>;
