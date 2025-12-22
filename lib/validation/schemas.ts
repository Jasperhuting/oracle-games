/**
 * Zod validation schemas for API request bodies
 * Provides runtime validation with type inference
 */

import { z } from 'zod';
import { GAME_TYPES, GAME_STATUSES, RACE_TYPES } from '../types/games';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

export const gameTypeSchema = z.enum(GAME_TYPES);
export const gameStatusSchema = z.enum(GAME_STATUSES);
export const raceTypeSchema = z.enum(RACE_TYPES);
export const acquisitionTypeSchema = z.enum(['auction', 'selection', 'draft', 'pick']);
export const messageTypeSchema = z.enum(['broadcast', 'individual']);
export const userTypeSchema = z.enum(['admin', 'user']);

// ============================================================================
// GAME MANAGEMENT SCHEMAS
// ============================================================================

export const createGameSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  name: z.string().min(1, 'Game name is required'),
  gameType: gameTypeSchema,
  year: z.number().int().min(2020).max(2100),
  raceType: raceTypeSchema,
  raceSlug: z.string().optional(),
  status: gameStatusSchema.optional(),
  registrationOpenDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  division: z.string().optional(),
  divisionLevel: z.number().int().positive().optional(),
  divisionCount: z.number().int().positive().optional(),
  maxPlayers: z.number().int().positive().optional(),
  minPlayers: z.number().int().positive().optional(),
  eligibleTeams: z.array(z.string()).optional(),
  eligibleRiders: z.array(z.string()).optional(),
  bidding: z.boolean(),
  config: z.any(), // Game-specific config - validated separately per game type
});

export const updateGameSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  name: z.string().min(1).optional(),
  status: gameStatusSchema.optional(),
  registrationOpenDate: z.string().datetime().optional(),
  registrationCloseDate: z.string().datetime().optional(),
  maxPlayers: z.number().int().positive().optional(),
  minPlayers: z.number().int().positive().optional(),
  eligibleTeams: z.array(z.string()).optional(),
  eligibleRiders: z.array(z.string()).optional(),
  config: z.any().optional(),
}).passthrough(); // Allow additional fields

export const updateGameStatusSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  status: gameStatusSchema,
});

// ============================================================================
// GAME PARTICIPATION SCHEMAS
// ============================================================================

export const joinGameSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

// ============================================================================
// BIDDING SCHEMAS
// ============================================================================

export const placeBidSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  riderNameId: z.string().min(1, 'Rider name ID is required'),
  amount: z.number().positive('Amount must be positive'),
  riderName: z.string().optional(),
  riderTeam: z.string().optional(),
  jerseyImage: z.string().url().optional().or(z.literal('')),
});

export const cancelBidSchema = z.object({
  bidId: z.string().min(1, 'Bid ID is required'),
  userId: z.string().min(1, 'User ID is required'),
});

// ============================================================================
// TEAM MANAGEMENT SCHEMAS
// ============================================================================

export const addRiderToTeamSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  riderNameId: z.string().min(1, 'Rider name ID is required'),
  riderName: z.string().min(1, 'Rider name is required'),
  riderTeam: z.string().min(1, 'Rider team is required'),
  riderCountry: z.string().min(1, 'Rider country is required'),
  jerseyImage: z.string().url().optional().or(z.literal('')),
  acquisitionType: acquisitionTypeSchema,
  pricePaid: z.number().nonnegative().optional(),
  draftRound: z.number().int().positive().optional(),
  draftPick: z.number().int().positive().optional(),
});

// ============================================================================
// USER MANAGEMENT SCHEMAS
// ============================================================================

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  playername: z.string().min(1, 'Playername is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  userType: userTypeSchema.optional(),
});

export const changeUserTypeSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  targetUserId: z.string().min(1, 'Target user ID is required'),
  newUserType: userTypeSchema,
});

export const deleteUserSchema = z.object({
  adminUserId: z.string().min(1, 'Admin user ID is required'),
  targetUserId: z.string().min(1, 'Target user ID is required'),
});

// ============================================================================
// MESSAGE SCHEMAS
// ============================================================================

export const sendMessageSchema = z.object({
  senderId: z.string().min(1, 'Sender ID is required'),
  type: messageTypeSchema,
  recipientId: z.string().min(1).optional(),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
}).refine(
  (data) => {
    // If type is 'individual', recipientId is required
    if (data.type === 'individual') {
      return !!data.recipientId;
    }
    return true;
  },
  {
    message: 'Recipient ID is required for individual messages',
    path: ['recipientId'],
  }
);

// ============================================================================
// GAME RULES SCHEMAS
// ============================================================================

export const saveGameRulesSchema = z.object({
  gameType: gameTypeSchema,
  rules: z.string(),
  userId: z.string().min(1, 'User ID is required'),
});

// ============================================================================
// FEEDBACK SCHEMAS
// ============================================================================

export const submitFeedbackSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  userEmail: z.string().email('Invalid email address'),
  currentPage: z.string().min(1, 'Current page is required'),
  message: z.string().min(1, 'Message is required').max(5000, 'Message too long'),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

// Export inferred types from schemas
export type CreateGameInput = z.infer<typeof createGameSchema>;
export type UpdateGameInput = z.infer<typeof updateGameSchema>;
export type UpdateGameStatusInput = z.infer<typeof updateGameStatusSchema>;
export type JoinGameInput = z.infer<typeof joinGameSchema>;
export type PlaceBidInput = z.infer<typeof placeBidSchema>;
export type CancelBidInput = z.infer<typeof cancelBidSchema>;
export type AddRiderToTeamInput = z.infer<typeof addRiderToTeamSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type ChangeUserTypeInput = z.infer<typeof changeUserTypeSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SaveGameRulesInput = z.infer<typeof saveGameRulesSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
