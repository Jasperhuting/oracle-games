/**
 * Calendar utilities
 * Helper functions and constants for the race calendar feature
 */

import type { CalendarGame, CalendarRace } from '@/lib/types';

// Dutch month names
export const MONTHS_NL = [
  'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
  'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
];

// Dutch day names
export const DAYS_NL = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

// UCI Race Classification descriptions
export const CLASSIFICATION_LABELS: Record<string, string> = {
  // World Tour
  '2.UWT': 'UCI WorldTour (Grote Rondes & Monumenten)',
  '1.UWT': 'UCI WorldTour (Eendaagse)',
  // Pro Series
  '2.Pro': 'UCI ProSeries (Meerdaagse)',
  '1.Pro': 'UCI ProSeries (Eendaagse)',
  // Class 1 & 2
  '2.1': 'Klasse 1 (Meerdaagse)',
  '1.1': 'Klasse 1 (Eendaagse)',
  '2.2': 'Klasse 2 (Meerdaagse)',
  '1.2': 'Klasse 2 (Eendaagse)',
  // National Championships
  'NC': 'Nationaal Kampioenschap',
  'CC': 'Continentaal Kampioenschap',
  'WC': 'Wereldkampioenschap',
  // Women
  '2.WWT': 'Women\'s WorldTour (Meerdaagse)',
  '1.WWT': 'Women\'s WorldTour (Eendaagse)',
  // Other
  'GT': 'Grand Tour',
  'ME': 'Mannen Elite',
  'MU': 'Mannen U23',
  'WE': 'Vrouwen Elite',
};

/**
 * Get display label for classification code
 */
export function getClassificationLabel(code: string): string {
  return CLASSIFICATION_LABELS[code] || code;
}

/**
 * Filter out test games
 */
export function filterTestGames(games: CalendarGame[]): CalendarGame[] {
  return games.filter(g => !g.name.toLowerCase().includes('test'));
}

/**
 * Filter out unwanted race classifications
 */
export function filterUnwantedClassifications(races: CalendarRace[]): CalendarRace[] {
  const unwantedClassifications = ['MJ', 'MU', 'WJ', 'WU', 'WE', 'WWT'];

  // Check if classification is in race name instead
  const filtered = races.filter(race => {
    const classification = (race.classification || '').trim();
    const hasUnwantedInName = unwantedClassifications.some(cls =>
      race.name.includes(cls) || race.name.includes(`${cls} -`)
    );
    const hasUnwantedInClassification = unwantedClassifications.some(cls =>
      classification.includes(cls)
    );
    const nameLower = race.name.toLowerCase();
    const slugLower = (race.slug || '').toLowerCase();
    const hasWomenInName = nameLower.includes('women') || nameLower.includes('vrouw') || nameLower.includes('dames');
    const hasWomenInSlug = slugLower.includes('women') || slugLower.includes('vrouw') || slugLower.includes('dames');
    const hasWWTInClassification = classification.includes('WWT');
    const isWomenClassification = classification.includes('.W') || classification.endsWith('W');

    if (hasUnwantedInName || hasUnwantedInClassification || hasWomenInName || hasWomenInSlug || hasWWTInClassification || isWomenClassification) {
      console.log('Filtering out race:', race.name, 'classification:', classification, 'hasWWT:', hasWWTInClassification);
    }

    return !hasUnwantedInName && !hasUnwantedInClassification && !hasWomenInName && !hasWomenInSlug && !hasWWTInClassification && !isWomenClassification;
  });

  console.log('Original races:', races.length);
  console.log('Filtered races:', filtered.length);
  return filtered;
}

/**
 * Group races by month
 */
export function groupRacesByMonth(races: CalendarRace[]): Map<number, CalendarRace[]> {
  const grouped = new Map<number, CalendarRace[]>();

  races.forEach(race => {
    const month = new Date(race.startDate).getMonth();
    if (!grouped.has(month)) {
      grouped.set(month, []);
    }
    grouped.get(month)!.push(race);
  });

  return grouped;
}

/**
 * Format date range for display
 */
export function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = start.toLocaleDateString('nl-NL', { month: 'short' });
  const endMonth = end.toLocaleDateString('nl-NL', { month: 'short' });

  // Same day (single-day race)
  if (startDate === endDate) {
    return `${startDay} ${startMonth}`;
  }

  // Same month
  if (start.getMonth() === end.getMonth()) {
    return `${startDay}-${endDay} ${startMonth}`;
  }

  // Different months
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}
