export const KNOWN_RACE_SLUGS = [
  'tour-de-france',
  'giro-d-italia',
  'vuelta-a-espana',
  'world-championship',
  'milano-sanremo',
  'amstel-gold-race',
  'tirreno-adriatico',
  'liege-bastogne-liege',
  'il-lombardia',
  'la-fleche-wallone',
  'paris-nice',
  'paris-roubaix',
  'volta-a-catalunya',
  'dauphine',
  'ronde-van-vlaanderen',
  'gent-wevelgem',
  'san-sebastian',
] as const;

export type RaceSlug = typeof KNOWN_RACE_SLUGS[number];

export interface Rider {
  nameID: string;
  name: string;
  country: string;
  startNumber: string;
  dropout: boolean;
}

export interface EnrichedRider {
  jerseyImage: string;
  name: string;
  age: number;
}

export interface EnrichedTeam {
    jerseyImageTeam: string;
    riders: EnrichedRider[];
    pcsRank: number;
    uciRank: number;
    points: number;
    country: string;
    name: string;
    class: string;
    teamName: string;
    teamNameID: string;
    year: number;
}

export interface Rider {
  name: string;
  rank: number;
  points: number;
  team?: RankedTeam;
  country: string;
  id: string;
}

export interface RankedRider {
  country: string;
  name: string;
  nameID: string;
  points: number;
  rank: number;
  team: string;
  firstName: string;
  lastName: string;
}

export interface RankedTeam {
  rank: number;
  name: string;
  nameID: string;
  slug: string;
  class: string;
  country: string;
  points: number;
  teamImage?: string;
}

export interface Team {
  id: string;
  image?: string;
  name: string;
  shortName?: string;
  riders?: Rider[];
  pcsRank?: number;
  rank?: number;
  points?: number;
  country?: string;
  slug?: string;
  class?: string;
}

export interface RankedTeamsResult {
  source: string;
  count: number;
  teams: RankedTeam[];
  scrapedAt: string;
  year: number;
}

export interface RankedRidersResult {
  source: string;
  count: number;
  riders: RankedRider[];
  scrapedAt: string;
  year: number;
}

export interface StartlistResult {
  race: string;
  year: number;
  source: string;
  count: number;
  riders: Team[];
  scrapedAt: string;
}

export interface StageRider {
  country: string;
  lastName: string;
  firstName: string;
  startNumber: string;
  gc: string;
  place: number;
  timeDifferenceGc: string;
  timeDifference: string;
  breakAway: boolean;
  team: string;
  shortName: string;
  uciPoints: string;
  points: string;
  qualificationTime?: number;
}

export interface TTTTeamResult {
  place: number;
  team: string;
  shortName: string;
  riders: {
    place: number;
    firstName: string;
    lastName: string;
  }[];
}

export interface ClassificationRider {
  place: number;
  rider?: string;
  lastName?: string;
  firstName?: string;
  country?: string;
  startNumber?: string;
  team: string;
  shortName?: string;
  pointsTotal?: number;
  points?: number;
  gc?: string;
  timeDifference?: string;
  uciPoints?: string;
  qualificationTime?: number;
}

export interface TeamClassification {
  place: number;
  team: string;
  shortName: string;
  class: string;
  timeInSeconds?: number;
}

export interface StageResult {
  race: string;
  year: number;
  source: string;
  count: number;
  stageResults: (StageRider | TTTTeamResult)[];
  generalClassification: ClassificationRider[];
  pointsClassification: ClassificationRider[];
  mountainsClassification: ClassificationRider[];
  youthClassification: ClassificationRider[];
  teamClassification: TeamClassification[];
  scrapedAt: string;
}

export interface Country {
    capital?: string,
    code: string,
    continent?: string,
    flag_1x1: string,
    flag_4x3: string,
    iso: boolean,
    name: string;
}