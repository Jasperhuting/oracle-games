import { z } from 'zod';

export const lastManStandingConfigSchema = z.object({
  budget: z.number().positive(),
  teamSize: z.number().int().positive(),
  eliminationSchedule: z.enum(['per-stage', 'per-race']),
});

export type LastManStandingConfigInput = z.infer<typeof lastManStandingConfigSchema>;
