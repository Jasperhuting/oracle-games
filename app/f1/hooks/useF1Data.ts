'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  getDoc,
} from 'firebase/firestore';
import { f1Db } from '@/lib/firebase/client';
import {
  F1Season,
  F1Team,
  F1Driver,
  F1Race,
  F1RaceResult,
  F1Participant,
  F1_COLLECTIONS,
  F1DriverWithTeam,
  LegacyDriver,
  toLegacyDriver,
  createRaceDocId,
  createParticipantDocId,
} from '../types';

const CURRENT_SEASON = 2026;

// ============================================
// useF1Season - Get active season
// ============================================
export function useF1Season() {
  const [season, setSeason] = useState<F1Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const docRef = doc(f1Db, F1_COLLECTIONS.SEASONS, String(CURRENT_SEASON));
    
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setSeason(snapshot.data() as F1Season);
        } else {
          setSeason(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching season:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { season, loading, error };
}

// ============================================
// useF1Teams - Get all teams for season
// ============================================
export function useF1Teams(season: number = CURRENT_SEASON) {
  const [teams, setTeams] = useState<F1Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(f1Db, F1_COLLECTIONS.TEAMS),
      where('season', '==', season),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const teamsData = snapshot.docs.map(doc => doc.data() as F1Team);
        setTeams(teamsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching teams:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season]);

  return { teams, loading, error };
}

// ============================================
// useF1Drivers - Get all drivers for season
// ============================================
export function useF1Drivers(season: number = CURRENT_SEASON) {
  const [drivers, setDrivers] = useState<F1Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(f1Db, F1_COLLECTIONS.DRIVERS),
      where('season', '==', season),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const driversData = snapshot.docs.map(doc => doc.data() as F1Driver);
        setDrivers(driversData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching drivers:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season]);

  return { drivers, loading, error };
}

// ============================================
// useF1DriversWithTeams - Get drivers with team data
// ============================================
export function useF1DriversWithTeams(season: number = CURRENT_SEASON) {
  const { drivers, loading: driversLoading, error: driversError } = useF1Drivers(season);
  const { teams, loading: teamsLoading, error: teamsError } = useF1Teams(season);

  const driversWithTeams: F1DriverWithTeam[] = drivers.map(driver => {
    const team = teams.find(t => t.id === driver.teamId);
    return {
      ...driver,
      team: team || {
        id: driver.teamId,
        name: driver.teamId,
        season,
        color: '#666666',
        shortName: driver.shortName,
        country: 'xx',
        isActive: true,
        createdAt: null as unknown as import('firebase/firestore').Timestamp,
      },
    };
  });

  return {
    drivers: driversWithTeams,
    loading: driversLoading || teamsLoading,
    error: driversError || teamsError,
  };
}

// ============================================
// useF1Races - Get all races for season
// ============================================
export function useF1Races(season: number = CURRENT_SEASON) {
  const [races, setRaces] = useState<F1Race[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Query without orderBy to avoid needing composite index
    // Sort client-side instead
    const q = query(
      collection(f1Db, F1_COLLECTIONS.RACES),
      where('season', '==', season)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const racesData = snapshot.docs
          .map(doc => doc.data() as F1Race)
          .sort((a, b) => a.round - b.round);
        setRaces(racesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching races:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season]);

  return { races, loading, error };
}

// ============================================
// useF1Race - Get single race
// ============================================
export function useF1Race(season: number, round: number) {
  const [race, setRace] = useState<F1Race | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const docId = createRaceDocId(season, round);
    const docRef = doc(f1Db, F1_COLLECTIONS.RACES, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setRace(snapshot.data() as F1Race);
        } else {
          setRace(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching race:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season, round]);

  return { race, loading, error };
}

// ============================================
// useF1RaceResult - Get race result
// ============================================
export function useF1RaceResult(season: number, round: number) {
  const [result, setResult] = useState<F1RaceResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const docId = createRaceDocId(season, round);
    const docRef = doc(f1Db, F1_COLLECTIONS.RACE_RESULTS, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setResult(snapshot.data() as F1RaceResult);
        } else {
          setResult(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching race result:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season, round]);

  return { result, loading, error };
}

// ============================================
// useF1RaceResults - Get all race results for a season
// ============================================
export function useF1RaceResults(season: number = CURRENT_SEASON) {
  const [results, setResults] = useState<F1RaceResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(f1Db, F1_COLLECTIONS.RACE_RESULTS),
      where('season', '==', season)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const resultsData = snapshot.docs.map(doc => doc.data() as F1RaceResult);
        setResults(resultsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching race results:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season]);

  return { results, loading, error };
}

// ============================================
// useF1LegacyDrivers - Get drivers in legacy format (for backward compatibility)
// ============================================
export function useF1LegacyDrivers(season: number = CURRENT_SEASON) {
  const { drivers, loading: driversLoading, error: driversError } = useF1Drivers(season);
  const { teams, loading: teamsLoading, error: teamsError } = useF1Teams(season);

  const legacyDrivers = useMemo(() => {
    return drivers.map(driver => {
      const team = teams.find(t => t.id === driver.teamId);
      if (!team) {
        return {
          firstName: driver.firstName,
          lastName: driver.lastName,
          shortName: driver.shortName,
          team: driver.teamId,
          number: driver.number,
          country: driver.country,
          image: driver.image,
          numberImage: driver.numberImage,
        };
      }
      return toLegacyDriver(driver, team);
    });
  }, [drivers, teams]);

  return {
    drivers: legacyDrivers,
    loading: driversLoading || teamsLoading,
    error: driversError || teamsError,
  };
}

// ============================================
// useF1Participants - Get ALL participants for a season
// ============================================
export function useF1Participants(season: number = CURRENT_SEASON) {
  const [participants, setParticipants] = useState<F1Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(f1Db, F1_COLLECTIONS.PARTICIPANTS),
      where('season', '==', season),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const participantsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as F1Participant));
        setParticipants(participantsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching participants:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season]);

  return { participants, loading, error };
}

// ============================================
// useF1Participant - Check if user is registered for F1 season
// ============================================
export function useF1Participant(userId: string | null, season: number = CURRENT_SEASON) {
  const [participant, setParticipant] = useState<F1Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!userId) {
      setParticipant(null);
      setLoading(false);
      return;
    }

    const docId = createParticipantDocId(userId, season);
    const docRef = doc(f1Db, F1_COLLECTIONS.PARTICIPANTS, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setParticipant({ id: snapshot.id, ...snapshot.data() } as F1Participant);
        } else {
          setParticipant(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching participant:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId, season]);

  return { participant, isParticipant: !!participant, loading, error };
}
