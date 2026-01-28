import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebaseF1, getServerAuth } from '@/lib/firebase/server';
import { drivers as hardcodedDrivers, races2026 as hardcodedRaces } from '../../../data';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

const f1Db = getServerFirebaseF1();

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

// Helper to get team country
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

// Helper to check if user is admin
async function isAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return false;

    const auth = getServerAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    
    // Check admin status in database
    const adminDoc = await f1Db.collection('admins').doc(decodedToken.uid).get();
    return adminDoc.exists && adminDoc.data()?.isAdmin === true;
  } catch {
    return false;
  }
}

const SEASON = 2026;

// POST /api/f1/admin/migrate - Run migration (Admin only)
export async function POST(request: NextRequest) {
  try {
    // Check admin
    if (!(await isAdmin())) {
      return NextResponse.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const now = FieldValue.serverTimestamp();
    const results = {
      season: false,
      teams: 0,
      drivers: 0,
      races: 0,
    };

    // ============================================
    // 1. Create Season
    // ============================================
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
    results.season = true;

    // ============================================
    // 2. Extract and Create Teams
    // ============================================
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
      results.teams++;
    }

    await teamsBatch.commit();

    // ============================================
    // 3. Create Drivers
    // ============================================
    const driversBatch = f1Db.batch();

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
      results.drivers++;
    }

    await driversBatch.commit();

    // ============================================
    // 4. Create Races
    // ============================================
    const racesBatch = f1Db.batch();
    const currentDate = new Date();

    for (const race of hardcodedRaces) {
      const docId = createRaceDocId(SEASON, race.round);
      const docRef = f1Db.collection(F1_COLLECTIONS.RACES).doc(docId);

      const startDate = new Date(race.startDate);
      const endDate = new Date(race.endDate);
      
      let status: 'upcoming' | 'open' | 'done';
      if (endDate < currentDate) {
        status = 'done';
      } else if (startDate <= currentDate && endDate >= currentDate) {
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
        createdAt: now,
      };

      racesBatch.set(docRef, raceData);
      results.races++;
    }

    await racesBatch.commit();

    return NextResponse.json({
      success: true,
      data: {
        message: 'Migration completed successfully',
        season: SEASON,
        teamsCreated: results.teams,
        driversCreated: results.drivers,
        racesCreated: results.races,
      },
    });
  } catch (error) {
    console.error('Error running migration:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run migration' },
      { status: 500 }
    );
  }
}

// GET /api/f1/admin/migrate - Check migration status
export async function GET() {
  try {
    const seasonDoc = await f1Db.collection(F1_COLLECTIONS.SEASONS).doc(String(SEASON)).get();
    const teamsSnapshot = await f1Db.collection(F1_COLLECTIONS.TEAMS).where('season', '==', SEASON).get();
    const driversSnapshot = await f1Db.collection(F1_COLLECTIONS.DRIVERS).where('season', '==', SEASON).get();
    const racesSnapshot = await f1Db.collection(F1_COLLECTIONS.RACES).where('season', '==', SEASON).get();

    return NextResponse.json({
      success: true,
      data: {
        season: SEASON,
        seasonExists: seasonDoc.exists,
        teamsCount: teamsSnapshot.size,
        driversCount: driversSnapshot.size,
        racesCount: racesSnapshot.size,
        expectedTeams: 11,
        expectedDrivers: 22,
        expectedRaces: 25,
      },
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check migration status' },
      { status: 500 }
    );
  }
}
