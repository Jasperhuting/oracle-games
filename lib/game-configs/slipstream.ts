import { z } from 'zod';
import { slipstreamRaceSchema } from './shared';

export const slipstreamConfigSchema = z.object({
  allowReuse: z.literal(false),
  countingRaces: z.array(slipstreamRaceSchema),
  penaltyMinutes: z.number().nonnegative(),
  pickDeadlineMinutes: z.number().nonnegative(),
  // JSON object keys are always strings; Record<number, number> at TS level
  greenJerseyPoints: z.record(z.number().nonnegative()),
});

export type SlipstreamConfigInput = z.infer<typeof slipstreamConfigSchema>;
