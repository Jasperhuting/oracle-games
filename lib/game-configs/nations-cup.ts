import { z } from 'zod';

export const nationsCupConfigSchema = z.object({
  regions: z.array(z.string().min(1)),
  budgetPerRegion: z.number().positive().optional(),
});

export type NationsCupConfigInput = z.infer<typeof nationsCupConfigSchema>;
