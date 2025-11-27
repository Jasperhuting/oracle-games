// Knockout phase match structure for WK 2026

export interface KnockoutMatch {
  id: string; // e.g., "match_73", "match_104"
  matchNumber: number; // 73-104
  round: 'round_of_32' | 'round_of_16' | 'quarterfinals' | 'semifinals' | 'third_place' | 'final';
  date: string;
  stadium: string;
  location: string;
  team1Source: string; // e.g., "2A", "winner_73", "3A/B/C/D/F"
  team2Source: string;
  team1?: string | null; // Actual team ID once determined
  team2?: string | null;
  team1Score?: number | null;
  team2Score?: number | null;
  winner?: string | null; // Team ID of the winner
}

// All 32 knockout matches
export const KNOCKOUT_MATCHES: Omit<KnockoutMatch, 'team1' | 'team2' | 'team1Score' | 'team2Score' | 'winner'>[] = [
  // Round of 32 (Laatste 32) - Matches 73-88
  { id: 'match_73', matchNumber: 73, round: 'round_of_32', date: '2026-06-28', stadium: 'SoFi Stadium', location: 'Inglewood', team1Source: '2A', team2Source: '2B' },
  { id: 'match_74', matchNumber: 74, round: 'round_of_32', date: '2026-06-29', stadium: 'Gillette Stadium', location: 'Foxborough', team1Source: '1E', team2Source: '3A/B/C/D/F' },
  { id: 'match_75', matchNumber: 75, round: 'round_of_32', date: '2026-06-29', stadium: 'Estadio BBVA Bancomer', location: 'Guadalupe', team1Source: '1F', team2Source: '2C' },
  { id: 'match_76', matchNumber: 76, round: 'round_of_32', date: '2026-06-29', stadium: 'NRG Stadium', location: 'Houston', team1Source: '1C', team2Source: '2F' },
  { id: 'match_77', matchNumber: 77, round: 'round_of_32', date: '2026-06-30', stadium: 'MetLife Stadium', location: 'East Rutherford', team1Source: '1I', team2Source: '3C/D/F/G/H' },
  { id: 'match_78', matchNumber: 78, round: 'round_of_32', date: '2026-06-30', stadium: 'AT&T Stadium', location: 'Arlington', team1Source: '2E', team2Source: '2I' },
  { id: 'match_79', matchNumber: 79, round: 'round_of_32', date: '2026-06-30', stadium: 'Aztekenstadion', location: 'Mexico-Stad', team1Source: '1A', team2Source: '3C/E/F/H/I' },
  { id: 'match_80', matchNumber: 80, round: 'round_of_32', date: '2026-07-01', stadium: 'Mercedes-Benz Stadium', location: 'Atlanta', team1Source: '1L', team2Source: '3E/H/I/J/K' },
  { id: 'match_81', matchNumber: 81, round: 'round_of_32', date: '2026-07-01', stadium: "Levi's Stadium", location: 'Santa Clara', team1Source: '1D', team2Source: '3B/E/F/I/J' },
  { id: 'match_82', matchNumber: 82, round: 'round_of_32', date: '2026-07-01', stadium: 'Lumen Field', location: 'Seattle', team1Source: '1G', team2Source: '3A/E/H/I/J' },
  { id: 'match_83', matchNumber: 83, round: 'round_of_32', date: '2026-07-02', stadium: 'BMO Field', location: 'Toronto', team1Source: '2K', team2Source: '2L' },
  { id: 'match_84', matchNumber: 84, round: 'round_of_32', date: '2026-07-02', stadium: 'SoFi Stadium', location: 'Inglewood', team1Source: '1H', team2Source: '2J' },
  { id: 'match_85', matchNumber: 85, round: 'round_of_32', date: '2026-07-02', stadium: 'BC Place Stadium', location: 'Vancouver', team1Source: '1B', team2Source: '3E/F/G/I/J' },
  { id: 'match_86', matchNumber: 86, round: 'round_of_32', date: '2026-07-03', stadium: 'Hard Rock Stadium', location: 'Miami Gardens', team1Source: '1J', team2Source: '2H' },
  { id: 'match_87', matchNumber: 87, round: 'round_of_32', date: '2026-07-03', stadium: 'Arrowhead Stadium', location: 'Kansas City', team1Source: '1K', team2Source: '3D/E/I/J/L' },
  { id: 'match_88', matchNumber: 88, round: 'round_of_32', date: '2026-07-03', stadium: 'AT&T Stadium', location: 'Arlington', team1Source: '2D', team2Source: '2G' },

  // Round of 16 (Achtste finales) - Matches 89-96
  { id: 'match_89', matchNumber: 89, round: 'round_of_16', date: '2026-07-04', stadium: 'Lincoln Financial Field', location: 'Philadelphia', team1Source: 'winner_74', team2Source: 'winner_77' },
  { id: 'match_90', matchNumber: 90, round: 'round_of_16', date: '2026-07-04', stadium: 'NRG Stadium', location: 'Houston', team1Source: 'winner_73', team2Source: 'winner_75' },
  { id: 'match_91', matchNumber: 91, round: 'round_of_16', date: '2026-07-05', stadium: 'MetLife Stadium', location: 'East Rutherford', team1Source: 'winner_76', team2Source: 'winner_78' },
  { id: 'match_92', matchNumber: 92, round: 'round_of_16', date: '2026-07-05', stadium: 'Aztekenstadion', location: 'Mexico-Stad', team1Source: 'winner_79', team2Source: 'winner_80' },
  { id: 'match_93', matchNumber: 93, round: 'round_of_16', date: '2026-07-06', stadium: 'AT&T Stadium', location: 'Arlington', team1Source: 'winner_83', team2Source: 'winner_84' },
  { id: 'match_94', matchNumber: 94, round: 'round_of_16', date: '2026-07-06', stadium: 'Lumen Field', location: 'Seattle', team1Source: 'winner_81', team2Source: 'winner_82' },
  { id: 'match_95', matchNumber: 95, round: 'round_of_16', date: '2026-07-07', stadium: 'Mercedes-Benz Stadium', location: 'Atlanta', team1Source: 'winner_86', team2Source: 'winner_88' },
  { id: 'match_96', matchNumber: 96, round: 'round_of_16', date: '2026-07-07', stadium: 'BC Place Stadium', location: 'Vancouver', team1Source: 'winner_85', team2Source: 'winner_87' },

  // Quarterfinals (Kwartfinales) - Matches 97-100
  { id: 'match_97', matchNumber: 97, round: 'quarterfinals', date: '2026-07-09', stadium: 'Gillette Stadium', location: 'Foxborough', team1Source: 'winner_89', team2Source: 'winner_90' },
  { id: 'match_98', matchNumber: 98, round: 'quarterfinals', date: '2026-07-10', stadium: 'SoFi Stadium', location: 'Inglewood', team1Source: 'winner_93', team2Source: 'winner_94' },
  { id: 'match_99', matchNumber: 99, round: 'quarterfinals', date: '2026-07-11', stadium: 'Hard Rock Stadium', location: 'Miami Gardens', team1Source: 'winner_91', team2Source: 'winner_92' },
  { id: 'match_100', matchNumber: 100, round: 'quarterfinals', date: '2026-07-11', stadium: 'Arrowhead Stadium', location: 'Kansas City', team1Source: 'winner_95', team2Source: 'winner_96' },

  // Semifinals (Halve finales) - Matches 101-102
  { id: 'match_101', matchNumber: 101, round: 'semifinals', date: '2026-07-14', stadium: 'AT&T Stadium', location: 'Arlington', team1Source: 'winner_97', team2Source: 'winner_98' },
  { id: 'match_102', matchNumber: 102, round: 'semifinals', date: '2026-07-15', stadium: 'Mercedes-Benz Stadium', location: 'Atlanta', team1Source: 'winner_99', team2Source: 'winner_100' },

  // Third Place (Troostfinale) - Match 103
  { id: 'match_103', matchNumber: 103, round: 'third_place', date: '2026-07-18', stadium: 'Hard Rock Stadium', location: 'Miami Gardens', team1Source: 'loser_101', team2Source: 'loser_102' },

  // Final (Finale) - Match 104
  { id: 'match_104', matchNumber: 104, round: 'final', date: '2026-07-19', stadium: 'MetLife Stadium', location: 'East Rutherford', team1Source: 'winner_101', team2Source: 'winner_102' },
];

export const ROUND_LABELS = {
  round_of_32: 'Laatste 32',
  round_of_16: 'Achtste finales',
  quarterfinals: 'Kwartfinales',
  semifinals: 'Halve finales',
  third_place: 'Troostfinale',
  final: 'Finale',
};

// Helper to determine which third-placed teams qualify based on group rankings
// Returns the group letter of the 3rd placed team that goes to a specific position
export function determineThirdPlaceQualifier(
  slot: string, // e.g., "3A/B/C/D/F"
  thirdPlacedRankings: Array<{ group: string; teamId: string; position: number }>
): string | null {
  // The slot format is like "3A/B/C/D/F" meaning one of the 3rd place teams from groups A, B, C, D, or F
  const possibleGroups = slot.replace('3', '').split('/').map(g => g.toLowerCase());

  // Find the highest ranked third-placed team from the possible groups
  for (const ranking of thirdPlacedRankings) {
    if (possibleGroups.includes(ranking.group)) {
      return ranking.teamId;
    }
  }

  return null;
}
