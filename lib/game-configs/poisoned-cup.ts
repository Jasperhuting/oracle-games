import { z } from 'zod';

export const poisonedCupConfigSchema = z.object({
  teamSize: z.number().int().positive(),
  budget: z.number().positive(),
  draftOrder: z.array(z.string()),
  currentDraftRound: z.number().int().nonnegative(),
  currentDraftPick: z.string(),
  snakeDraft: z.boolean(),
});

export type PoisonedCupConfigInput = z.infer<typeof poisonedCupConfigSchema>;
