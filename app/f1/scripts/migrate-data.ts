/**
 * Migration script to move hardcoded F1 data to Firestore
 * 
 * Run with: npx ts-node --project tsconfig.json app/f1/scripts/migrate-data.ts
 * Or: npx tsx app/f1/scripts/migrate-data.ts
 */

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { drivers as hardcodedDrivers, races2026 as hardcodedRaces } from '../data';

// Collection names
const F1_COLLECTIONS = {
  SEASONS: 'seasons',
  TEAMS: 'teams',
  DRIVERS: 'drivers',
  RACES: 'races',
} as const;

// Helper functions for document IDs
function createTeamDocId(teamId: string, season: number): string {
  return `${teamId}_${season}`;
}

function createDriverDocId(shortName: string, season: number): string {
  return `${shortName}_${season}`;
}

function createRaceDocId(season: number, round: number): string {
  return `${season}_${String(round).padStart(2, '0')}`;
}

// Initialize Firebase Admin
function initFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin credentials. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
    projectId,
  });
}

const SEASON = 2026;

async function migrateData() {
  console.log('🚀 Starting F1 data migration...\n');

  const app = initFirebaseAdmin();
  if (!app) {
    throw new Error('Failed to initialize Firebase Admin');
  }
  const f1Db = getFirestore(app, 'oracle-games-f1');

  const now = Timestamp.now();

  // ============================================
  // 1. Create Season
  // ============================================
  console.log('📅 Creating season...');
  
  const seasonData = {
    year: SEASON,
    name: `F1 ${SEASON} Season`,
    startDate: '2026-03-06',
    endDate: '2026-12-06',
    isActive: true,
    totalRaces: 24,
    createdAt: now,
    updatedAt: now,
  };

  await f1Db.collection(F1_COLLECTIONS.SEASONS).doc(String(SEASON)).set(seasonData);
  console.log(`   ✅ Season ${SEASON} created\n`);

  // ============================================
  // 2. Extract and Create Teams
  // ============================================
  console.log('🏎️  Creating teams...');

  // Extract unique teams from drivers
  const teamsMap = new Map<string, {
    name: string;
    color: string;
    colorAlt?: string;
    carImage?: string;
  }>();

  for (const driver of hardcodedDrivers) {
    if (!teamsMap.has(driver.team)) {
      teamsMap.set(driver.team, {
        name: driver.team,
        color: driver.teamColor || '#666666',
        colorAlt: driver.teamColorAlt,
        carImage: driver.carImage,
      });
    }
  }

  const teamsBatch = f1Db.batch();
  let teamCount = 0;

  for (const [teamName, teamData] of teamsMap) {
    const teamId = teamName.toLowerCase().replace(/\s+/g, '-');
    const docId = createTeamDocId(teamId, SEASON);
    const docRef = f1Db.collection(F1_COLLECTIONS.TEAMS).doc(docId);

    const team = {
      id: teamId,
      name: teamData.name,
      season: SEASON,
      color: teamData.color,
      colorAlt: teamData.colorAlt,
      carImage: teamData.carImage,
      country: getTeamCountry(teamName),
      isActive: true,
      createdAt: now,
    };

    teamsBatch.set(docRef, team);
    teamCount++;
    console.log(`   📝 ${teamData.name}`);
  }

  await teamsBatch.commit();
  console.log(`   ✅ ${teamCount} teams created\n`);

  // ============================================
  // 3. Create Drivers
  // ============================================
  console.log('👨‍🔧 Creating drivers...');

  const driversBatch = f1Db.batch();
  let driverCount = 0;

  for (const driver of hardcodedDrivers) {
    const teamId = driver.team.toLowerCase().replace(/\s+/g, '-');
    const docId = createDriverDocId(driver.shortName, SEASON);
    const docRef = f1Db.collection(F1_COLLECTIONS.DRIVERS).doc(docId);

    const driverData = {
      shortName: driver.shortName,
      firstName: driver.firstName,
      lastName: driver.lastName,
      teamId,
      season: SEASON,
      number: driver.number,
      country: driver.country,
      image: driver.image,
      numberImage: driver.numberImage,
      isActive: true,
      createdAt: now,
    };

    driversBatch.set(docRef, driverData);
    driverCount++;
    console.log(`   📝 ${driver.firstName} ${driver.lastName} (${driver.shortName})`);
  }

  await driversBatch.commit();
  console.log(`   ✅ ${driverCount} drivers created\n`);

  // ============================================
  // 4. Create Races
  // ============================================
  console.log('🏁 Creating races...');

  const racesBatch = f1Db.batch();
  let raceCount = 0;

  for (const race of hardcodedRaces) {
    const docId = createRaceDocId(SEASON, race.round);
    const docRef = f1Db.collection(F1_COLLECTIONS.RACES).doc(docId);

    // Determine race status based on dates
    const now = new Date();
    const startDate = new Date(race.startDate);
    const endDate = new Date(race.endDate);
    
    let status: 'upcoming' | 'open' | 'done';
    if (endDate < now) {
      status = 'done';
    } else if (startDate <= now && endDate >= now) {
      status = 'open';
    } else {
      status = 'upcoming';
    }

    const raceData = {
      round: race.round,
      season: SEASON,
      name: race.name,
      subName: race.subName,
      startDate: race.startDate,
      endDate: race.endDate,
      raceImage: race.raceImage,
      raceRoundPosition: race.raceRoundPosition,
      status,
      createdAt: Timestamp.now(),
    };

    racesBatch.set(docRef, raceData);
    raceCount++;
    console.log(`   📝 Round ${race.round}: ${race.name}`);
  }

  await racesBatch.commit();
  console.log(`   ✅ ${raceCount} races created\n`);

  // ============================================
  // Summary
  // ============================================
  console.log('═══════════════════════════════════════');
  console.log('✅ Migration completed successfully!');
  console.log('═══════════════════════════════════════');
  console.log(`   Season: ${SEASON}`);
  console.log(`   Teams: ${teamCount}`);
  console.log(`   Drivers: ${driverCount}`);
  console.log(`   Races: ${raceCount}`);
  console.log('═══════════════════════════════════════\n');
}

// Helper function to get team country
function getTeamCountry(teamName: string): string {
  const teamCountries: Record<string, string> = {
    'Alpine': 'fr',
    'Aston Martin': 'gb',
    'Audi': 'de',
    'Cadillac': 'us',
    'Ferrari': 'it',
    'Haas F1 Team': 'us',
    'McLaren': 'gb',
    'Mercedes': 'de',
    'Racing Bulls': 'it',
    'Red Bull Racing': 'at',
    'Williams': 'gb',
  };
  return teamCountries[teamName] || 'xx';
}

// Run migration
migrateData().catch(console.error);
