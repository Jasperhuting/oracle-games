// All 72 group stage fixtures for WK 2026
// Source: FIFA official schedule
// Times shown are CEST (Dutch local time)

export interface GroupStageFixture {
  matchNumber: number; // 1–72
  group: string; // 'a'–'l'
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM' CEST
  stadium: string;
  city: string;
  team1Name: string; // English name as stored in Firestore
  team1Code: string; // ISO flag code
  team2Name: string;
  team2Code: string;
}

// Maps FIFA name -> ISO country code for flag rendering
export const TEAM_CODE_MAP: Record<string, string> = {
  'Mexico': 'mx',
  'South Africa': 'za',
  'Korea Republic': 'kr',
  'Czechia': 'cz',
  'Czech Republic': 'cz',
  'Canada': 'ca',
  'Bosnia-Herzegovina': 'ba',
  'Qatar': 'qa',
  'Switzerland': 'ch',
  'Brazil': 'br',
  'Morocco': 'ma',
  'Haiti': 'ht',
  'Scotland': 'gb-sct',
  'USA': 'us',
  'United States': 'us',
  'Paraguay': 'py',
  'Australia': 'au',
  'Türkiye': 'tr',
  'Turkey': 'tr',
  'Germany': 'de',
  'Curaçao': 'cw',
  'Curacao': 'cw',
  "Côte d'Ivoire": 'ci',
  "Cote d'Ivoire": 'ci',
  "Ivory Coast": 'ci',
  'Ecuador': 'ec',
  'Netherlands': 'nl',
  'Japan': 'jp',
  'Sweden': 'se',
  'Tunisia': 'tn',
  'Belgium': 'be',
  'Egypt': 'eg',
  'IR Iran': 'ir',
  'Iran': 'ir',
  'New Zealand': 'nz',
  'Spain': 'es',
  'Cabo Verde': 'cv',
  'Cape Verde': 'cv',
  'Saudi Arabia': 'sa',
  'Uruguay': 'uy',
  'France': 'fr',
  'Senegal': 'sn',
  'Iraq': 'iq',
  'Norway': 'no',
  'Argentina': 'ar',
  'Algeria': 'dz',
  'Austria': 'at',
  'Jordan': 'jo',
  'Portugal': 'pt',
  'Congo DR': 'cd',
  'DR Congo': 'cd',
  'Uzbekistan': 'uz',
  'Colombia': 'co',
  'England': 'gb-eng',
  'Croatia': 'hr',
  'Ghana': 'gh',
  'Panama': 'pa',
};

export function getTeamCode(name: string): string {
  return TEAM_CODE_MAP[name] ?? name.slice(0, 2).toLowerCase();
}

export const GROUP_STAGE_FIXTURES: GroupStageFixture[] = [
  // --- GROUP A: Mexico, South Africa, Korea Republic, Czechia ---
  { matchNumber: 1,  group: 'a', date: '2026-06-11', time: '21:00', stadium: 'Mexico City Stadium',            city: 'Mexico City',        team1Name: 'Mexico',           team1Code: 'mx',     team2Name: 'South Africa',     team2Code: 'za' },
  { matchNumber: 2,  group: 'a', date: '2026-06-12', time: '04:00', stadium: 'Guadalajara Stadium',            city: 'Guadalajara',        team1Name: 'Korea Republic',   team1Code: 'kr',     team2Name: 'Czechia',          team2Code: 'cz' },
  { matchNumber: 25, group: 'a', date: '2026-06-18', time: '18:00', stadium: 'Atlanta Stadium',                city: 'Atlanta',            team1Name: 'Czechia',          team1Code: 'cz',     team2Name: 'South Africa',     team2Code: 'za' },
  { matchNumber: 28, group: 'a', date: '2026-06-19', time: '03:00', stadium: 'Guadalajara Stadium',            city: 'Guadalajara',        team1Name: 'Mexico',           team1Code: 'mx',     team2Name: 'Korea Republic',   team2Code: 'kr' },
  { matchNumber: 53, group: 'a', date: '2026-06-25', time: '03:00', stadium: 'Mexico City Stadium',            city: 'Mexico City',        team1Name: 'Czechia',          team1Code: 'cz',     team2Name: 'Mexico',           team2Code: 'mx' },
  { matchNumber: 54, group: 'a', date: '2026-06-25', time: '03:00', stadium: 'Monterrey Stadium',              city: 'Monterrey',          team1Name: 'South Africa',     team1Code: 'za',     team2Name: 'Korea Republic',   team2Code: 'kr' },

  // --- GROUP B: Canada, Bosnia-Herzegovina, Qatar, Switzerland ---
  { matchNumber: 3,  group: 'b', date: '2026-06-12', time: '21:00', stadium: 'Toronto Stadium',                city: 'Toronto',            team1Name: 'Canada',           team1Code: 'ca',     team2Name: 'Bosnia-Herzegovina', team2Code: 'ba' },
  { matchNumber: 5,  group: 'b', date: '2026-06-13', time: '21:00', stadium: 'San Francisco Bay Area Stadium', city: 'San Francisco Bay Area', team1Name: 'Qatar',         team1Code: 'qa',     team2Name: 'Switzerland',      team2Code: 'ch' },
  { matchNumber: 26, group: 'b', date: '2026-06-18', time: '21:00', stadium: 'Los Angeles Stadium',            city: 'Los Angeles',        team1Name: 'Switzerland',      team1Code: 'ch',     team2Name: 'Bosnia-Herzegovina', team2Code: 'ba' },
  { matchNumber: 27, group: 'b', date: '2026-06-19', time: '00:00', stadium: 'BC Place Vancouver',             city: 'Vancouver',          team1Name: 'Canada',           team1Code: 'ca',     team2Name: 'Qatar',            team2Code: 'qa' },
  { matchNumber: 49, group: 'b', date: '2026-06-24', time: '21:00', stadium: 'BC Place Vancouver',             city: 'Vancouver',          team1Name: 'Switzerland',      team1Code: 'ch',     team2Name: 'Canada',           team2Code: 'ca' },
  { matchNumber: 50, group: 'b', date: '2026-06-24', time: '21:00', stadium: 'Seattle Stadium',                city: 'Seattle',            team1Name: 'Bosnia-Herzegovina', team1Code: 'ba',   team2Name: 'Qatar',            team2Code: 'qa' },

  // --- GROUP C: Brazil, Morocco, Haiti, Scotland ---
  { matchNumber: 6,  group: 'c', date: '2026-06-14', time: '00:00', stadium: 'New York/New Jersey Stadium',    city: 'New York',           team1Name: 'Brazil',           team1Code: 'br',     team2Name: 'Morocco',          team2Code: 'ma' },
  { matchNumber: 7,  group: 'c', date: '2026-06-14', time: '03:00', stadium: 'Boston Stadium',                 city: 'Boston',             team1Name: 'Haiti',            team1Code: 'ht',     team2Name: 'Scotland',         team2Code: 'gb-sct' },
  { matchNumber: 30, group: 'c', date: '2026-06-20', time: '00:00', stadium: 'Boston Stadium',                 city: 'Boston',             team1Name: 'Scotland',         team1Code: 'gb-sct', team2Name: 'Morocco',          team2Code: 'ma' },
  { matchNumber: 31, group: 'c', date: '2026-06-20', time: '02:30', stadium: 'Philadelphia Stadium',           city: 'Philadelphia',       team1Name: 'Brazil',           team1Code: 'br',     team2Name: 'Haiti',            team2Code: 'ht' },
  { matchNumber: 51, group: 'c', date: '2026-06-25', time: '00:00', stadium: 'Miami Stadium',                  city: 'Miami',              team1Name: 'Scotland',         team1Code: 'gb-sct', team2Name: 'Brazil',           team2Code: 'br' },
  { matchNumber: 52, group: 'c', date: '2026-06-25', time: '00:00', stadium: 'Atlanta Stadium',                city: 'Atlanta',            team1Name: 'Morocco',          team1Code: 'ma',     team2Name: 'Haiti',            team2Code: 'ht' },

  // --- GROUP D: USA, Paraguay, Australia, Türkiye ---
  { matchNumber: 4,  group: 'd', date: '2026-06-13', time: '03:00', stadium: 'Los Angeles Stadium',            city: 'Los Angeles',        team1Name: 'USA',              team1Code: 'us',     team2Name: 'Paraguay',         team2Code: 'py' },
  { matchNumber: 8,  group: 'd', date: '2026-06-14', time: '06:00', stadium: 'BC Place Vancouver',             city: 'Vancouver',          team1Name: 'Australia',        team1Code: 'au',     team2Name: 'Türkiye',          team2Code: 'tr' },
  { matchNumber: 29, group: 'd', date: '2026-06-19', time: '21:00', stadium: 'Seattle Stadium',                city: 'Seattle',            team1Name: 'USA',              team1Code: 'us',     team2Name: 'Australia',        team2Code: 'au' },
  { matchNumber: 32, group: 'd', date: '2026-06-20', time: '05:00', stadium: 'San Francisco Bay Area Stadium', city: 'San Francisco Bay Area', team1Name: 'Türkiye',       team1Code: 'tr',     team2Name: 'Paraguay',         team2Code: 'py' },
  { matchNumber: 59, group: 'd', date: '2026-06-26', time: '04:00', stadium: 'Los Angeles Stadium',            city: 'Los Angeles',        team1Name: 'Türkiye',          team1Code: 'tr',     team2Name: 'USA',              team2Code: 'us' },
  { matchNumber: 60, group: 'd', date: '2026-06-26', time: '04:00', stadium: 'San Francisco Bay Area Stadium', city: 'San Francisco Bay Area', team1Name: 'Paraguay',      team1Code: 'py',     team2Name: 'Australia',        team2Code: 'au' },

  // --- GROUP E: Germany, Curaçao, Côte d'Ivoire, Ecuador ---
  { matchNumber: 9,  group: 'e', date: '2026-06-14', time: '19:00', stadium: 'Houston Stadium',                city: 'Houston',            team1Name: 'Germany',          team1Code: 'de',     team2Name: 'Curaçao',          team2Code: 'cw' },
  { matchNumber: 11, group: 'e', date: '2026-06-15', time: '01:00', stadium: 'Philadelphia Stadium',           city: 'Philadelphia',       team1Name: "Côte d'Ivoire",    team1Code: 'ci',     team2Name: 'Ecuador',          team2Code: 'ec' },
  { matchNumber: 34, group: 'e', date: '2026-06-20', time: '22:00', stadium: 'Toronto Stadium',                city: 'Toronto',            team1Name: 'Germany',          team1Code: 'de',     team2Name: "Côte d'Ivoire",    team2Code: 'ci' },
  { matchNumber: 35, group: 'e', date: '2026-06-21', time: '02:00', stadium: 'Kansas City Stadium',            city: 'Kansas City',        team1Name: 'Ecuador',          team1Code: 'ec',     team2Name: 'Curaçao',          team2Code: 'cw' },
  { matchNumber: 55, group: 'e', date: '2026-06-25', time: '22:00', stadium: 'Philadelphia Stadium',           city: 'Philadelphia',       team1Name: 'Curaçao',          team1Code: 'cw',     team2Name: "Côte d'Ivoire",    team2Code: 'ci' },
  { matchNumber: 56, group: 'e', date: '2026-06-25', time: '22:00', stadium: 'New York/New Jersey Stadium',    city: 'New York',           team1Name: 'Ecuador',          team1Code: 'ec',     team2Name: 'Germany',          team2Code: 'de' },

  // --- GROUP F: Netherlands, Japan, Sweden, Tunisia ---
  { matchNumber: 10, group: 'f', date: '2026-06-14', time: '22:00', stadium: 'Dallas Stadium',                 city: 'Dallas',             team1Name: 'Netherlands',      team1Code: 'nl',     team2Name: 'Japan',            team2Code: 'jp' },
  { matchNumber: 12, group: 'f', date: '2026-06-15', time: '04:00', stadium: 'Monterrey Stadium',              city: 'Monterrey',          team1Name: 'Sweden',           team1Code: 'se',     team2Name: 'Tunisia',          team2Code: 'tn' },
  { matchNumber: 33, group: 'f', date: '2026-06-20', time: '19:00', stadium: 'Houston Stadium',                city: 'Houston',            team1Name: 'Netherlands',      team1Code: 'nl',     team2Name: 'Sweden',           team2Code: 'se' },
  { matchNumber: 36, group: 'f', date: '2026-06-21', time: '06:00', stadium: 'Monterrey Stadium',              city: 'Monterrey',          team1Name: 'Tunisia',          team1Code: 'tn',     team2Name: 'Japan',            team2Code: 'jp' },
  { matchNumber: 57, group: 'f', date: '2026-06-26', time: '01:00', stadium: 'Dallas Stadium',                 city: 'Dallas',             team1Name: 'Japan',            team1Code: 'jp',     team2Name: 'Sweden',           team2Code: 'se' },
  { matchNumber: 58, group: 'f', date: '2026-06-26', time: '01:00', stadium: 'Kansas City Stadium',            city: 'Kansas City',        team1Name: 'Tunisia',          team1Code: 'tn',     team2Name: 'Netherlands',      team2Code: 'nl' },

  // --- GROUP G: Belgium, Egypt, IR Iran, New Zealand ---
  { matchNumber: 14, group: 'g', date: '2026-06-15', time: '21:00', stadium: 'Seattle Stadium',                city: 'Seattle',            team1Name: 'Belgium',          team1Code: 'be',     team2Name: 'Egypt',            team2Code: 'eg' },
  { matchNumber: 16, group: 'g', date: '2026-06-16', time: '03:00', stadium: 'Los Angeles Stadium',            city: 'Los Angeles',        team1Name: 'IR Iran',          team1Code: 'ir',     team2Name: 'New Zealand',      team2Code: 'nz' },
  { matchNumber: 38, group: 'g', date: '2026-06-21', time: '21:00', stadium: 'Los Angeles Stadium',            city: 'Los Angeles',        team1Name: 'Belgium',          team1Code: 'be',     team2Name: 'IR Iran',          team2Code: 'ir' },
  { matchNumber: 40, group: 'g', date: '2026-06-22', time: '03:00', stadium: 'BC Place Vancouver',             city: 'Vancouver',          team1Name: 'New Zealand',      team1Code: 'nz',     team2Name: 'Egypt',            team2Code: 'eg' },
  { matchNumber: 65, group: 'g', date: '2026-06-27', time: '05:00', stadium: 'Seattle Stadium',                city: 'Seattle',            team1Name: 'Egypt',            team1Code: 'eg',     team2Name: 'IR Iran',          team2Code: 'ir' },
  { matchNumber: 66, group: 'g', date: '2026-06-27', time: '05:00', stadium: 'BC Place Vancouver',             city: 'Vancouver',          team1Name: 'New Zealand',      team1Code: 'nz',     team2Name: 'Belgium',          team2Code: 'be' },

  // --- GROUP H: Spain, Cabo Verde, Saudi Arabia, Uruguay ---
  { matchNumber: 13, group: 'h', date: '2026-06-15', time: '18:00', stadium: 'Atlanta Stadium',                city: 'Atlanta',            team1Name: 'Spain',            team1Code: 'es',     team2Name: 'Cabo Verde',       team2Code: 'cv' },
  { matchNumber: 15, group: 'h', date: '2026-06-16', time: '00:00', stadium: 'Miami Stadium',                  city: 'Miami',              team1Name: 'Saudi Arabia',     team1Code: 'sa',     team2Name: 'Uruguay',          team2Code: 'uy' },
  { matchNumber: 37, group: 'h', date: '2026-06-21', time: '18:00', stadium: 'Atlanta Stadium',                city: 'Atlanta',            team1Name: 'Spain',            team1Code: 'es',     team2Name: 'Saudi Arabia',     team2Code: 'sa' },
  { matchNumber: 39, group: 'h', date: '2026-06-22', time: '00:00', stadium: 'Miami Stadium',                  city: 'Miami',              team1Name: 'Uruguay',          team1Code: 'uy',     team2Name: 'Cabo Verde',       team2Code: 'cv' },
  { matchNumber: 63, group: 'h', date: '2026-06-27', time: '02:00', stadium: 'Houston Stadium',                city: 'Houston',            team1Name: 'Cabo Verde',       team1Code: 'cv',     team2Name: 'Saudi Arabia',     team2Code: 'sa' },
  { matchNumber: 64, group: 'h', date: '2026-06-27', time: '02:00', stadium: 'Guadalajara Stadium',            city: 'Guadalajara',        team1Name: 'Uruguay',          team1Code: 'uy',     team2Name: 'Spain',            team2Code: 'es' },

  // --- GROUP I: France, Senegal, Iraq, Norway ---
  { matchNumber: 17, group: 'i', date: '2026-06-16', time: '21:00', stadium: 'New York/New Jersey Stadium',    city: 'New York',           team1Name: 'France',           team1Code: 'fr',     team2Name: 'Senegal',          team2Code: 'sn' },
  { matchNumber: 18, group: 'i', date: '2026-06-17', time: '00:00', stadium: 'Boston Stadium',                 city: 'Boston',             team1Name: 'Iraq',             team1Code: 'iq',     team2Name: 'Norway',           team2Code: 'no' },
  { matchNumber: 42, group: 'i', date: '2026-06-22', time: '23:00', stadium: 'Philadelphia Stadium',           city: 'Philadelphia',       team1Name: 'France',           team1Code: 'fr',     team2Name: 'Iraq',             team2Code: 'iq' },
  { matchNumber: 43, group: 'i', date: '2026-06-23', time: '02:00', stadium: 'New York/New Jersey Stadium',    city: 'New York',           team1Name: 'Norway',           team1Code: 'no',     team2Name: 'Senegal',          team2Code: 'sn' },
  { matchNumber: 61, group: 'i', date: '2026-06-26', time: '21:00', stadium: 'Boston Stadium',                 city: 'Boston',             team1Name: 'Norway',           team1Code: 'no',     team2Name: 'France',           team2Code: 'fr' },
  { matchNumber: 62, group: 'i', date: '2026-06-26', time: '21:00', stadium: 'Toronto Stadium',                city: 'Toronto',            team1Name: 'Senegal',          team1Code: 'sn',     team2Name: 'Iraq',             team2Code: 'iq' },

  // --- GROUP J: Argentina, Algeria, Austria, Jordan ---
  { matchNumber: 19, group: 'j', date: '2026-06-17', time: '03:00', stadium: 'Kansas City Stadium',            city: 'Kansas City',        team1Name: 'Argentina',        team1Code: 'ar',     team2Name: 'Algeria',          team2Code: 'dz' },
  { matchNumber: 20, group: 'j', date: '2026-06-17', time: '06:00', stadium: 'San Francisco Bay Area Stadium', city: 'San Francisco Bay Area', team1Name: 'Austria',       team1Code: 'at',     team2Name: 'Jordan',           team2Code: 'jo' },
  { matchNumber: 41, group: 'j', date: '2026-06-22', time: '19:00', stadium: 'Dallas Stadium',                 city: 'Dallas',             team1Name: 'Argentina',        team1Code: 'ar',     team2Name: 'Austria',          team2Code: 'at' },
  { matchNumber: 44, group: 'j', date: '2026-06-23', time: '05:00', stadium: 'San Francisco Bay Area Stadium', city: 'San Francisco Bay Area', team1Name: 'Jordan',        team1Code: 'jo',     team2Name: 'Algeria',          team2Code: 'dz' },
  { matchNumber: 71, group: 'j', date: '2026-06-28', time: '04:00', stadium: 'Kansas City Stadium',            city: 'Kansas City',        team1Name: 'Algeria',          team1Code: 'dz',     team2Name: 'Austria',          team2Code: 'at' },
  { matchNumber: 72, group: 'j', date: '2026-06-28', time: '04:00', stadium: 'Dallas Stadium',                 city: 'Dallas',             team1Name: 'Jordan',           team1Code: 'jo',     team2Name: 'Argentina',        team2Code: 'ar' },

  // --- GROUP K: Portugal, Congo DR, Uzbekistan, Colombia ---
  { matchNumber: 21, group: 'k', date: '2026-06-17', time: '19:00', stadium: 'Houston Stadium',                city: 'Houston',            team1Name: 'Portugal',         team1Code: 'pt',     team2Name: 'Congo DR',         team2Code: 'cd' },
  { matchNumber: 24, group: 'k', date: '2026-06-18', time: '04:00', stadium: 'Mexico City Stadium',            city: 'Mexico City',        team1Name: 'Uzbekistan',       team1Code: 'uz',     team2Name: 'Colombia',         team2Code: 'co' },
  { matchNumber: 45, group: 'k', date: '2026-06-23', time: '19:00', stadium: 'Houston Stadium',                city: 'Houston',            team1Name: 'Portugal',         team1Code: 'pt',     team2Name: 'Uzbekistan',       team2Code: 'uz' },
  { matchNumber: 48, group: 'k', date: '2026-06-24', time: '04:00', stadium: 'Guadalajara Stadium',            city: 'Guadalajara',        team1Name: 'Colombia',         team1Code: 'co',     team2Name: 'Congo DR',         team2Code: 'cd' },
  { matchNumber: 69, group: 'k', date: '2026-06-28', time: '01:30', stadium: 'Miami Stadium',                  city: 'Miami',              team1Name: 'Colombia',         team1Code: 'co',     team2Name: 'Portugal',         team2Code: 'pt' },
  { matchNumber: 70, group: 'k', date: '2026-06-28', time: '01:30', stadium: 'Atlanta Stadium',                city: 'Atlanta',            team1Name: 'Congo DR',         team1Code: 'cd',     team2Name: 'Uzbekistan',       team2Code: 'uz' },

  // --- GROUP L: England, Croatia, Ghana, Panama ---
  { matchNumber: 22, group: 'l', date: '2026-06-17', time: '22:00', stadium: 'Dallas Stadium',                 city: 'Dallas',             team1Name: 'England',          team1Code: 'gb-eng', team2Name: 'Croatia',          team2Code: 'hr' },
  { matchNumber: 23, group: 'l', date: '2026-06-18', time: '01:00', stadium: 'Toronto Stadium',                city: 'Toronto',            team1Name: 'Ghana',            team1Code: 'gh',     team2Name: 'Panama',           team2Code: 'pa' },
  { matchNumber: 46, group: 'l', date: '2026-06-23', time: '22:00', stadium: 'Boston Stadium',                 city: 'Boston',             team1Name: 'England',          team1Code: 'gb-eng', team2Name: 'Ghana',            team2Code: 'gh' },
  { matchNumber: 47, group: 'l', date: '2026-06-24', time: '01:00', stadium: 'Toronto Stadium',                city: 'Toronto',            team1Name: 'Panama',           team1Code: 'pa',     team2Name: 'Croatia',          team2Code: 'hr' },
  { matchNumber: 67, group: 'l', date: '2026-06-27', time: '23:00', stadium: 'New York/New Jersey Stadium',    city: 'New York',           team1Name: 'Panama',           team1Code: 'pa',     team2Name: 'England',          team2Code: 'gb-eng' },
  { matchNumber: 68, group: 'l', date: '2026-06-27', time: '23:00', stadium: 'Philadelphia Stadium',           city: 'Philadelphia',       team1Name: 'Croatia',          team1Code: 'hr',     team2Name: 'Ghana',            team2Code: 'gh' },
];
