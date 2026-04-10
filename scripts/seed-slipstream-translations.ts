/**
 * Seed script: voegt slipstream vertalingen toe aan de Firestore translations collection.
 *
 * Gebruik: npx ts-node -r tsconfig-paths/register scripts/seed-slipstream-translations.ts
 *
 * Vereiste env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

if (getApps().length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Ontbrekende Firebase credentials in .env.local');
    console.error('   Vereist: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
    process.exit(1);
  }

  initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

const db = getFirestore();

const slipstreamEn = {
  loading: 'Loading...',
  back: 'Back',
  yourStats: 'Your Stats',
  timeLost: 'Time Lost',
  greenPoints: 'Green Points',
  picksMade: 'Picks Made',
  selectRace: 'Select Race',
  selectRider: 'Select Rider',
  selectRaceFirst: 'Select a race first',
  currentPick: 'Current pick:',
  lockedLabel: '(locked)',
  noPickForRace: 'No pick for this race',
  cancel: 'Cancel',
  busy: 'Busy...',
  deletePick: 'Delete pick',
  updatePick: 'Update pick',
  submitPick: 'Submit pick',
  errorLoadingMatrix: 'Could not load results matrix',
  needsPick: 'Needs Pick',
  upcoming: 'Upcoming',
  finished: 'Finished',
  all: 'All',
  picked: 'picked',
  needPick: 'need pick',
  racesCompleted: 'races completed',
  allRacesHavePicks: 'All races have picks! 🎉',
  noRacesFound: 'No races found',
  locked: 'Locked',
  noPickYet: 'No pick yet',
  available: 'available',
  used: 'used',
  team: 'Team',
  filterByTeamPlaceholder: 'Filter by team...',
  unknownTeam: 'Unknown team',
  remove: 'Remove',
  searchRider: 'Search a rider...',
  showUsedRiders: 'Show used riders',
  pickSelectionDisabled: 'Pick selection is disabled',
  currentPickLabel: 'Current pick:',
  standings: 'Standings',
  yellowJersey: 'Yellow Jersey',
  greenJersey: 'Green Jersey',
  player: 'Player',
  timeLostHeader: 'Time Lost',
  points: 'Points',
  gap: 'Gap',
  noStandingsYet: 'No standings yet',
  you: '(you)',
  picks: 'picks',
  missed: 'missed',
  yellowJerseyInfo: 'Yellow Jersey: Lowest cumulative time lost wins',
  greenJerseyInfo: 'Green Jersey: Highest points from top-10 finishes wins',
  raceCalendar: 'Race Calendar',
  races: 'races',
  addRace: 'Add Race',
  add2026Classics: 'Add 2026 Classics',
  adding: 'Adding...',
  raceSlugPlaceholder: 'Race slug (e.g. milano-sanremo)',
  raceNamePlaceholder: 'Race name',
  add: 'Add',
  noRacesConfigured: 'No races configured yet.',
  addDefaultCalendarHint: 'Click "Add 2026 Classics" to add the default calendar.',
  lockPicks: 'Lock picks',
  unlock: 'Unlock',
  calculatePoints: 'Calculate points',
  calculating: 'Calculating...',
  recalculatePoints: 'Recalculate points',
  revertToLocked: 'Revert to locked',
  deleteRaceConfirm: 'Are you sure you want to remove this race?',
  cannotDeleteNonUpcoming: 'Cannot delete non-upcoming races',
  deleteRace: 'Delete race',
  picksMatrix: 'Picks matrix',
  participants: 'participants',
  visibleRaces: 'visible races',
  sortedBy: 'Sorted by:',
  sortHint: 'Click on a race column to sort by chosen rider (first name). Click again to reset.',
  participant: 'Participant',
  loadingOverview: 'Loading overview...',
  noParticipantsFound: 'No participants found for this game.',
  noRacesWithDeadlinePassed: 'No races with passed pick deadline yet.',
  sortByRace: 'Sort by this race',
};

const slipstreamNl = {
  loading: 'Laden...',
  back: 'Terug',
  yourStats: 'Jouw stats',
  timeLost: 'Verloren tijd',
  greenPoints: 'Groene punten',
  picksMade: 'Picks gedaan',
  selectRace: 'Kies race',
  selectRider: 'Kies renner',
  selectRaceFirst: 'Kies eerst een race',
  currentPick: 'Huidige pick:',
  lockedLabel: '(vergrendeld)',
  noPickForRace: 'Geen pick voor deze race',
  cancel: 'Annuleren',
  busy: 'Bezig...',
  deletePick: 'Pick verwijderen',
  updatePick: 'Pick bijwerken',
  submitPick: 'Pick indienen',
  errorLoadingMatrix: 'Kon resultatenmatrix niet laden',
  needsPick: 'Pick nodig',
  upcoming: 'Aankomend',
  finished: 'Afgerond',
  all: 'Alle',
  picked: 'gepickt',
  needPick: 'pick nodig',
  racesCompleted: 'races voltooid',
  allRacesHavePicks: 'Alle races hebben picks! 🎉',
  noRacesFound: 'Geen races gevonden',
  locked: 'Vergrendeld',
  noPickYet: 'Nog geen pick',
  available: 'beschikbaar',
  used: 'gebruikt',
  team: 'Team',
  filterByTeamPlaceholder: 'Filter op team...',
  unknownTeam: 'Onbekend team',
  remove: 'Verwijder',
  searchRider: 'Zoek een renner...',
  showUsedRiders: 'Toon gebruikte renners',
  pickSelectionDisabled: 'Pickselectie is uitgeschakeld',
  currentPickLabel: 'Huidige pick:',
  standings: 'Ranglijst',
  yellowJersey: 'Gele trui',
  greenJersey: 'Groene trui',
  player: 'Speler',
  timeLostHeader: 'Verloren tijd',
  points: 'Punten',
  gap: 'Achterstand',
  noStandingsYet: 'Nog geen ranglijst',
  you: '(jij)',
  picks: 'picks',
  missed: 'gemist',
  yellowJerseyInfo: 'Gele trui: Laagste cumulatieve verloren tijd wint',
  greenJerseyInfo: 'Groene trui: Hoogste punten van top-10 finishes wint',
  raceCalendar: 'Racecalender',
  races: 'races',
  addRace: 'Race toevoegen',
  add2026Classics: '2026 Klassiekers toevoegen',
  adding: 'Toevoegen...',
  raceSlugPlaceholder: 'Race slug (bijv. milano-sanremo)',
  raceNamePlaceholder: 'Racenaam',
  add: 'Toevoegen',
  noRacesConfigured: 'Nog geen races ingesteld.',
  addDefaultCalendarHint: 'Klik op "2026 Klassiekers toevoegen" om de standaardkalender toe te voegen.',
  lockPicks: 'Picks vergrendelen',
  unlock: 'Ontgrendelen',
  calculatePoints: 'Bereken punten',
  calculating: 'Berekenen...',
  recalculatePoints: 'Herbereken punten',
  revertToLocked: 'Terugzetten naar locked',
  deleteRaceConfirm: 'Weet je zeker dat je deze race wilt verwijderen?',
  cannotDeleteNonUpcoming: 'Kan niet-aankomende races niet verwijderen',
  deleteRace: 'Race verwijderen',
  picksMatrix: 'Picksmatrix',
  participants: 'deelnemers',
  visibleRaces: 'zichtbare races',
  sortedBy: 'Gesorteerd op:',
  sortHint: 'Klik op een racekolom om te sorteren op gekozen renner (voornaam). Klik opnieuw om te resetten.',
  participant: 'Deelnemer',
  loadingOverview: 'Overzicht laden...',
  noParticipantsFound: 'Geen deelnemers gevonden voor dit spel.',
  noRacesWithDeadlinePassed: 'Nog geen races met verstreken pickdeadline.',
  sortByRace: 'Sorteer op deze race',
};

async function seedTranslations() {
  const locales = [
    { locale: 'en', slipstream: slipstreamEn },
    { locale: 'nl', slipstream: slipstreamNl },
  ];

  for (const { locale, slipstream } of locales) {
    const ref = db.collection('translations').doc(locale);
    const snap = await ref.get();

    if (!snap.exists) {
      console.log(`⚠️  Document '${locale}' bestaat niet, aanmaken met alleen slipstream namespace...`);
      await ref.set({ slipstream });
    } else {
      const existing = snap.data() || {};
      const merged = { ...existing, slipstream };
      await ref.set(merged);
    }

    console.log(`✅ Vertalingen voor '${locale}' bijgewerkt (${Object.keys(slipstream).length} slipstream sleutels)`);
  }

  console.log('\n🎉 Klaar!');
}

seedTranslations().catch((err) => {
  console.error('❌ Fout:', err);
  process.exit(1);
});
