import { toISOString } from './dateHelpers';

/**
 * Serialize a game document for API responses
 * Converts Timestamps/Dates to ISO strings and DocumentReferences to paths
 */
export function serializeGame(game: any, id?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: id || game.id,
    ...game,
    createdAt: toISOString(game.createdAt),
    updatedAt: toISOString(game.updatedAt),
    registrationOpenDate: game.registrationOpenDate ? toISOString(game.registrationOpenDate) : undefined,
    registrationCloseDate: game.registrationCloseDate ? toISOString(game.registrationCloseDate) : undefined,
    raceRef: game.raceRef?.path || game.raceRef,
  };
}

/**
 * Serialize a participant document for API responses
 */
export function serializeParticipant(participant: any, id?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: id || participant.id,
    ...participant,
    joinedAt: toISOString(participant.joinedAt),
    eliminatedAt: participant.eliminatedAt ? toISOString(participant.eliminatedAt) : undefined,
  };
}

/**
 * Serialize a player team document for API responses
 */
export function serializePlayerTeam(team: any, id?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: id || team.id,
    ...team,
    acquiredAt: toISOString(team.acquiredAt),
  };
}

/**
 * Serialize a bid document for API responses
 */
export function serializeBid(bid: any, id?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: id || bid.id,
    ...bid,
    bidAt: toISOString(bid.bidAt),
  };
}

/**
 * Serialize a race lineup document for API responses
 */
export function serializeRaceLineup(lineup: any, id?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  return {
    id: id || lineup.id,
    ...lineup,
    updatedAt: toISOString(lineup.updatedAt),
    raceRef: lineup.raceRef?.path || lineup.raceRef,
  };
}
