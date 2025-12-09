import { toISOString } from './dateHelpers';
import type { Game, GameParticipant, PlayerTeam, Bid, ClientGame, ClientGameParticipant, ClientPlayerTeam, ClientBid } from '@/lib/types/games';

/**
 * Serialize a game document for API responses
 * Converts Timestamps/Dates to ISO strings and DocumentReferences to paths
 */
export function serializeGame(game: Game, id?: string): ClientGame {
  return {
    id: id || game.id,
    ...game,
    createdAt: toISOString(game.createdAt),
    updatedAt: toISOString(game.updatedAt),
    registrationOpenDate: game.registrationOpenDate ? toISOString(game.registrationOpenDate) : undefined,
    registrationCloseDate: game.registrationCloseDate ? toISOString(game.registrationCloseDate) : undefined,
    raceRef: game.raceRef,
  } as ClientGame;
}

/**
 * Serialize a participant document for API responses
 */
export function serializeParticipant(participant: GameParticipant, id?: string): ClientGameParticipant {
  return {
    id: id || participant.id,
    ...participant,
    joinedAt: toISOString(participant.joinedAt),
    eliminatedAt: participant.eliminatedAt ? toISOString(participant.eliminatedAt) : undefined,
  } as ClientGameParticipant;
}

/**
 * Serialize a player team document for API responses
 */
export function serializePlayerTeam(team: PlayerTeam, id?: string): ClientPlayerTeam {
  return {
    id: id || team.id,
    ...team,
    acquiredAt: toISOString(team.acquiredAt),
  } as ClientPlayerTeam;
}

/**
 * Serialize a bid document for API responses
 */
export function serializeBid(bid: Bid, id?: string): ClientBid {
  return {
    id: id || bid.id,
    ...bid,
    bidAt: toISOString(bid.bidAt),
  } as ClientBid;
}

interface RaceLineup {
  id?: string;
  updatedAt: Date | string;
  raceRef?: string | { path: string };
  [key: string]: unknown;
}

/**
 * Serialize a race lineup document for API responses
 */
export function serializeRaceLineup(lineup: RaceLineup, id?: string): RaceLineup & { id: string; updatedAt: string; raceRef?: string } {
  return {
    id: id || lineup.id || '',
    ...lineup,
    updatedAt: toISOString(lineup.updatedAt),
    raceRef: typeof lineup.raceRef === 'string' ? lineup.raceRef : lineup.raceRef?.path,
  };
}
