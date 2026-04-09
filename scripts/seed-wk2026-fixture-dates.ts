/**
 * Seed script: voegt datum, tijd, stadion en stad toe aan alle
 * groepsfase-wedstrijden in Firestore (poules collectie).
 *
 * Gebruik: npx ts-node -r tsconfig-paths/register scripts/seed-wk2026-fixture-dates.ts
 *
 * Vereiste env vars: FIREBASE_FOOTBALL_CREDENTIALS (of FIREBASE_ADMIN_CREDENTIALS)
 */

import * as admin from 'firebase-admin';
import { GROUP_STAGE_FIXTURES, TEAM_CODE_MAP } from '../lib/wk-2026/group-stage-fixtures';

// Normalize team name for matching (handle FIFA vs Firestore name differences)
const NAME_ALIASES: Record<string, string> = {
  'South Korea': 'Korea Republic',
  'Turkey': 'Türkiye',
  'Iran': 'IR Iran',
  'Czech Republic': 'Czechia',
  'Cape Verde': 'Cabo Verde',
  'DR Congo': 'Congo DR',
  'United States': 'USA',
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Ivory Coast": "Côte d'Ivoire",
  'Curacao': 'Curaçao',
};

function normalizeName(name: string): string {
  return NAME_ALIASES[name] ?? name;
}

async function main() {
  if (!admin.apps.length) {
    const credentials = process.env.FIREBASE_FOOTBALL_CREDENTIALS || process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (!credentials) {
      throw new Error('Missing FIREBASE_FOOTBALL_CREDENTIALS or FIREBASE_ADMIN_CREDENTIALS env var');
    }
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(credentials)),
      databaseURL: 'https://oracle-games-football.firebaseio.com',
    });
  }

  const db = admin.firestore();
  db.settings({ databaseId: 'oracle-games-football' });

  console.log('Fetching poules from Firestore...');
  const poulesSnapshot = await db.collection('poules').get();

  let totalUpdated = 0;
  let totalNotMatched = 0;

  for (const pouleDoc of poulesSnapshot.docs) {
    const data = pouleDoc.data();
    if (!data.matches || !data.teams) continue;

    const pouleId: string = data.pouleId; // 'a'–'l'

    // Build teamId -> name map for this poule
    const teamNames: Record<string, string> = {};
    for (const [teamId, teamData] of Object.entries(data.teams as Record<string, { name: string }>)) {
      teamNames[teamId] = normalizeName(teamData.name);
    }

    // Get all fixtures for this group
    const groupFixtures = GROUP_STAGE_FIXTURES.filter(f => f.group === pouleId);

    // Update each match with date/time/stadium/city
    const updatedMatches = { ...data.matches as Record<string, object> };
    let matchesUpdated = 0;

    for (const [matchId, matchData] of Object.entries(data.matches as Record<string, { team1Id: string; team2Id: string }>)) {
      const team1Name = teamNames[matchData.team1Id];
      const team2Name = teamNames[matchData.team2Id];

      if (!team1Name || !team2Name) continue;

      // Find matching fixture (order may differ)
      const fixture = groupFixtures.find(f =>
        (f.team1Name === team1Name && f.team2Name === team2Name) ||
        (f.team1Name === team2Name && f.team2Name === team1Name)
      );

      if (!fixture) {
        console.warn(`  No fixture found for group ${pouleId}: ${team1Name} vs ${team2Name}`);
        totalNotMatched++;
        continue;
      }

      updatedMatches[matchId] = {
        ...matchData,
        date: fixture.date,
        time: fixture.time,
        stadium: fixture.stadium,
        city: fixture.city,
        matchNumber: fixture.matchNumber,
      };
      matchesUpdated++;
    }

    if (matchesUpdated > 0) {
      await db.collection('poules').doc(pouleDoc.id).update({ matches: updatedMatches });
      console.log(`  Poule ${pouleId.toUpperCase()}: ${matchesUpdated} wedstrijden bijgewerkt`);
      totalUpdated += matchesUpdated;
    }
  }

  console.log(`\nKlaar! ${totalUpdated} wedstrijden bijgewerkt, ${totalNotMatched} niet gevonden.`);

  // Also seed a dedicated groupFixtures collection for reference
  console.log('\nSeeding groupFixtures collectie...');
  const batch = db.batch();
  for (const fixture of GROUP_STAGE_FIXTURES) {
    const docRef = db.collection('groupFixtures').doc(`match_${fixture.matchNumber}`);
    batch.set(docRef, {
      ...fixture,
      createdAt: new Date().toISOString(),
    });
  }
  await batch.commit();
  console.log(`${GROUP_STAGE_FIXTURES.length} fixtures opgeslagen in groupFixtures collectie.`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
