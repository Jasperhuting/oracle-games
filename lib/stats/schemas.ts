import { z } from "zod";
import {
  STATS_ADMIN_ROLES,
  STATS_CHART_TYPES,
  STATS_IDEA_SOURCES,
  STATS_IDEA_STATUSES,
  STATS_RUN_STATUSES,
  STATS_TOOL_NAMES,
} from "@/lib/stats/types";

export const statsAdminRoleSchema = z.enum(STATS_ADMIN_ROLES);
export const chartTypeSchema = z.enum(STATS_CHART_TYPES);
export const statRunStatusSchema = z.enum(STATS_RUN_STATUSES);
export const statIdeaStatusSchema = z.enum(STATS_IDEA_STATUSES);
export const statIdeaSourceSchema = z.enum(STATS_IDEA_SOURCES);
export const statsToolNameSchema = z.enum(STATS_TOOL_NAMES);

export const adminProfileSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().or(z.string().length(0)),
  role: statsAdminRoleSchema,
  allowedGames: z.array(z.string().min(1)).default([]),
  enabled: z.boolean(),
});

export const statIdeaItemSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(400),
  whyInteresting: z.string().min(10).max(400),
  chartType: chartTypeSchema,
  requiredTool: statsToolNameSchema,
  confidence: z.number().min(0).max(1),
});

export const statIdeaResponseSchema = z.object({
  ideas: z.array(statIdeaItemSchema).max(10),
});

export const generatedStatDataRowSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()])
);

export const generatedStatResponseSchema = z.object({
  title: z.string().min(3).max(160),
  summary: z.string().min(10).max(500),
  chartType: chartTypeSchema,
  data: z.array(generatedStatDataRowSchema).max(100),
  confidence: z.number().min(0).max(1),
});

export const generateIdeasInputSchema = z.object({
  gameId: z.string().min(1),
  maxIdeas: z.number().int().min(1).max(10).default(10),
});

export const createManualIdeaInputSchema = z.object({
  gameId: z.string().min(1),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(400),
  whyInteresting: z.string().min(10).max(400),
  chartType: chartTypeSchema,
  requiredTool: statsToolNameSchema,
  confidence: z.number().min(0).max(1).default(0.8),
});

export const updateIdeaInputSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().min(10).max(400).optional(),
  whyInteresting: z.string().min(10).max(400).optional(),
  chartType: chartTypeSchema.optional(),
  requiredTool: statsToolNameSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: statIdeaStatusSchema.optional(),
});

export const runStatInputSchema = z.object({
  gameId: z.string().min(1),
  ideaId: z.string().min(1),
  limit: z.number().int().min(1).max(25).optional(),
});

export const statsListFilterSchema = z.object({
  gameId: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(100).default(50),
});
