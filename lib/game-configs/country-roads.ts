import { z } from 'zod';

export const countryRoadsConfigSchema = z.object({
  poolCount: z.number().int().positive(),
  pools: z.array(z.string()),
});

export type CountryRoadsConfigInput = z.infer<typeof countryRoadsConfigSchema>;
