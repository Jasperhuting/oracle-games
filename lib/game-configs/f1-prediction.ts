import { z } from 'zod';
import { timestampSchema } from './shared';

export const f1PredictionConfigSchema = z.object({
  season: z.number().int().positive(),
  registrationOpen: z.boolean(),
  registrationDeadline: timestampSchema.optional(),
  maxParticipants: z.number().int().positive().optional(),
});

export type F1PredictionConfigInput = z.infer<typeof f1PredictionConfigSchema>;
