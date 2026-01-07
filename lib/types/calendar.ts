/**
 * Calendar Types
 * Types for the race calendar feature
 */

export interface CalendarGame {
  id: string;
  name: string;
  gameType: string;
}

export interface CalendarRace {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string;
  classification: string;
  country: string;
  games: CalendarGame[]; // Games where this specific race counts (via countingRaces)
}

export interface CalendarResponse {
  races: CalendarRace[];
  seasonalGames: CalendarGame[]; // Games where ALL races count (raceType === 'season')
}
