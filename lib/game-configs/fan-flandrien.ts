import { z } from 'zod';

export const fanFlandrienConfigSchema = z.object({
  predictionsPerRace: z.number().int().positive(),
  races: z.array(z.string()),
});

export type FanFlandrienConfigInput = z.infer<typeof fanFlandrienConfigSchema>;
