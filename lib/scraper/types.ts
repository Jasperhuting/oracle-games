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
  name: string;
  country: string;
  startNumber: string;
  dropout: boolean;
}

export interface Team {
  image?: string;
  name: string;
  shortName: string;
  riders: Rider[];
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
  timeDifference: string;
  team: string;
  shortName: string;
  uciPoints: string;
  points: string;
  qualificationTime: string;
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
  qualificationTime?: string;
}

export interface TeamClassification {
  place: number;
  team: string;
  shortName: string;
  class: string;
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