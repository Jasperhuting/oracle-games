import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch,
  arrayUnion,
  arrayRemove,
  DocumentReference,
  CollectionReference,
} from 'firebase/firestore';
import { f1Db } from '@/lib/firebase/client';
import { 
  F1Season, 
  F1Team, 
  F1Driver, 
  F1Race, 
  F1RaceResult,
  F1SubLeague,
  F1Prediction,
  F1Standing,
  F1PointsHistory,
  F1_COLLECTIONS,
  createRaceDocId,
  createPredictionDocId,
  createStandingDocId,
  createDriverDocId,
  createTeamDocId,
} from '../types';

// ============================================
// Collection References
// ============================================

export const seasonsRef = () => collection(f1Db, F1_COLLECTIONS.SEASONS);
export const teamsRef = () => collection(f1Db, F1_COLLECTIONS.TEAMS);
export const driversRef = () => collection(f1Db, F1_COLLECTIONS.DRIVERS);
export const racesRef = () => collection(f1Db, F1_COLLECTIONS.RACES);
export const raceResultsRef = () => collection(f1Db, F1_COLLECTIONS.RACE_RESULTS);
export const subLeaguesRef = () => collection(f1Db, F1_COLLECTIONS.SUB_LEAGUES);
export const predictionsRef = () => collection(f1Db, F1_COLLECTIONS.PREDICTIONS);
export const standingsRef = () => collection(f1Db, F1_COLLECTIONS.STANDINGS);

// ============================================
// Season Operations
// ============================================

export async function getSeason(year: number): Promise<F1Season | null> {
  const docRef = doc(seasonsRef(), String(year));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Season) : null;
}

export async function getActiveSeason(): Promise<F1Season | null> {
  const q = query(seasonsRef(), where('isActive', '==', true), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : (snapshot.docs[0].data() as F1Season);
}

export async function createSeason(season: Omit<F1Season, 'createdAt' | 'updatedAt'>): Promise<void> {
  const docRef = doc(seasonsRef(), String(season.year));
  await setDoc(docRef, {
    ...season,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Team Operations
// ============================================

export async function getTeamsBySeason(season: number): Promise<F1Team[]> {
  const q = query(teamsRef(), where('season', '==', season), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as F1Team));
}

export async function getTeam(teamId: string, season: number): Promise<F1Team | null> {
  const docRef = doc(teamsRef(), createTeamDocId(teamId, season));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Team) : null;
}

export async function createTeam(team: Omit<F1Team, 'createdAt'>): Promise<void> {
  const docRef = doc(teamsRef(), createTeamDocId(team.id, team.season));
  await setDoc(docRef, {
    ...team,
    createdAt: Timestamp.now(),
  });
}

// ============================================
// Driver Operations
// ============================================

export async function getDriversBySeason(season: number): Promise<F1Driver[]> {
  const q = query(driversRef(), where('season', '==', season), where('isActive', '==', true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1Driver);
}

export async function getDriver(shortName: string, season: number): Promise<F1Driver | null> {
  const docRef = doc(driversRef(), createDriverDocId(shortName, season));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Driver) : null;
}

export async function createDriver(driver: Omit<F1Driver, 'createdAt'>): Promise<void> {
  const docRef = doc(driversRef(), createDriverDocId(driver.shortName, driver.season));
  await setDoc(docRef, {
    ...driver,
    createdAt: Timestamp.now(),
  });
}

// ============================================
// Race Operations
// ============================================

export async function getRacesBySeason(season: number): Promise<F1Race[]> {
  const q = query(racesRef(), where('season', '==', season), orderBy('round', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1Race);
}

export async function getRace(season: number, round: number): Promise<F1Race | null> {
  const docRef = doc(racesRef(), createRaceDocId(season, round));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Race) : null;
}

export async function createRace(race: Omit<F1Race, 'createdAt'>): Promise<void> {
  const docRef = doc(racesRef(), createRaceDocId(race.season, race.round));
  await setDoc(docRef, {
    ...race,
    createdAt: Timestamp.now(),
  });
}

export async function updateRaceStatus(season: number, round: number, status: F1Race['status']): Promise<void> {
  const docRef = doc(racesRef(), createRaceDocId(season, round));
  await updateDoc(docRef, { status });
}

// ============================================
// Race Results Operations
// ============================================

export async function getRaceResult(season: number, round: number): Promise<F1RaceResult | null> {
  const docRef = doc(raceResultsRef(), createRaceDocId(season, round));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1RaceResult) : null;
}

export async function createRaceResult(result: Omit<F1RaceResult, 'createdAt'>): Promise<void> {
  const docRef = doc(raceResultsRef(), result.raceId);
  await setDoc(docRef, {
    ...result,
    createdAt: Timestamp.now(),
  });
}

// ============================================
// SubLeague Operations
// ============================================

export async function getSubLeaguesByUser(userId: string): Promise<F1SubLeague[]> {
  const q = query(subLeaguesRef(), where('memberIds', 'array-contains', userId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as F1SubLeague));
}

export async function getSubLeagueByCode(code: string): Promise<F1SubLeague | null> {
  const q = query(subLeaguesRef(), where('code', '==', code.toUpperCase()), limit(1));
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : ({ ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as F1SubLeague);
}

export async function getSubLeague(id: string): Promise<F1SubLeague | null> {
  const docRef = doc(subLeaguesRef(), id);
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? ({ ...snapshot.data(), id: snapshot.id } as F1SubLeague) : null;
}

export async function createSubLeague(subLeague: Omit<F1SubLeague, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = doc(subLeaguesRef());
  await setDoc(docRef, {
    ...subLeague,
    code: subLeague.code.toUpperCase(),
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return docRef.id;
}

export async function joinSubLeague(subLeagueId: string, userId: string): Promise<void> {
  const docRef = doc(subLeaguesRef(), subLeagueId);
  await updateDoc(docRef, {
    memberIds: arrayUnion(userId),
    updatedAt: Timestamp.now(),
  });
}

export async function leaveSubLeague(subLeagueId: string, userId: string): Promise<void> {
  const docRef = doc(subLeaguesRef(), subLeagueId);
  await updateDoc(docRef, {
    memberIds: arrayRemove(userId),
    updatedAt: Timestamp.now(),
  });
}

// ============================================
// Prediction Operations
// ============================================

export async function getPrediction(userId: string, season: number, round: number): Promise<F1Prediction | null> {
  const docRef = doc(predictionsRef(), createPredictionDocId(userId, season, round));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Prediction) : null;
}

export async function getPredictionsByUser(userId: string, season: number): Promise<F1Prediction[]> {
  const q = query(predictionsRef(), where('userId', '==', userId), where('season', '==', season));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1Prediction);
}

export async function getPredictionsByRace(season: number, round: number): Promise<F1Prediction[]> {
  const raceId = createRaceDocId(season, round);
  const q = query(predictionsRef(), where('raceId', '==', raceId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1Prediction);
}

export async function savePrediction(prediction: Omit<F1Prediction, 'submittedAt' | 'updatedAt'>): Promise<void> {
  const docId = createPredictionDocId(prediction.userId, prediction.season, prediction.round);
  const docRef = doc(predictionsRef(), docId);
  const existing = await getDoc(docRef);
  
  if (existing.exists()) {
    await updateDoc(docRef, {
      ...prediction,
      updatedAt: Timestamp.now(),
    });
  } else {
    await setDoc(docRef, {
      ...prediction,
      submittedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }
}

export async function lockPrediction(userId: string, season: number, round: number): Promise<void> {
  const docRef = doc(predictionsRef(), createPredictionDocId(userId, season, round));
  await updateDoc(docRef, { isLocked: true });
}

// ============================================
// Standings Operations
// ============================================

export async function getStanding(userId: string, season: number): Promise<F1Standing | null> {
  const docRef = doc(standingsRef(), createStandingDocId(userId, season));
  const snapshot = await getDoc(docRef);
  return snapshot.exists() ? (snapshot.data() as F1Standing) : null;
}

export async function getStandingsBySeason(season: number): Promise<F1Standing[]> {
  const q = query(standingsRef(), where('season', '==', season), orderBy('totalPoints', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1Standing);
}

export async function updateStanding(standing: F1Standing): Promise<void> {
  const docRef = doc(standingsRef(), createStandingDocId(standing.userId, standing.season));
  await setDoc(docRef, {
    ...standing,
    updatedAt: Timestamp.now(),
  }, { merge: true });
}

// ============================================
// Points History Operations
// ============================================

export async function getPointsHistory(userId: string, season: number): Promise<F1PointsHistory[]> {
  const standingDocId = createStandingDocId(userId, season);
  const historyRef = collection(f1Db, F1_COLLECTIONS.STANDINGS, standingDocId, F1_COLLECTIONS.POINTS_HISTORY);
  const q = query(historyRef, orderBy('round', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as F1PointsHistory);
}

export async function savePointsHistory(userId: string, season: number, history: F1PointsHistory): Promise<void> {
  const standingDocId = createStandingDocId(userId, season);
  const historyRef = doc(f1Db, F1_COLLECTIONS.STANDINGS, standingDocId, F1_COLLECTIONS.POINTS_HISTORY, String(history.round));
  await setDoc(historyRef, history);
}

// ============================================
// Batch Operations
// ============================================

export async function batchCreateTeams(teams: Omit<F1Team, 'createdAt'>[]): Promise<void> {
  const batch = writeBatch(f1Db);
  const now = Timestamp.now();
  
  for (const team of teams) {
    const docRef = doc(teamsRef(), createTeamDocId(team.id, team.season));
    batch.set(docRef, { ...team, createdAt: now });
  }
  
  await batch.commit();
}

export async function batchCreateDrivers(drivers: Omit<F1Driver, 'createdAt'>[]): Promise<void> {
  const batch = writeBatch(f1Db);
  const now = Timestamp.now();
  
  for (const driver of drivers) {
    const docRef = doc(driversRef(), createDriverDocId(driver.shortName, driver.season));
    batch.set(docRef, { ...driver, createdAt: now });
  }
  
  await batch.commit();
}

export async function batchCreateRaces(races: Omit<F1Race, 'createdAt'>[]): Promise<void> {
  const batch = writeBatch(f1Db);
  const now = Timestamp.now();
  
  for (const race of races) {
    const docRef = doc(racesRef(), createRaceDocId(race.season, race.round));
    batch.set(docRef, { ...race, createdAt: now });
  }
  
  await batch.commit();
}

// ============================================
// Utility Functions
// ============================================

export function generateSubLeagueCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
