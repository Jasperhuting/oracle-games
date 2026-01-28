'use client';

import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { f1Db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  F1Standing, 
  F1SubLeague,
  F1_COLLECTIONS,
  createStandingDocId,
} from '../types';

const CURRENT_SEASON = 2026;

// ============================================
// useF1Standings - Get standings for season
// ============================================
export function useF1Standings(season: number = CURRENT_SEASON, subLeagueId?: string) {
  const [standings, setStandings] = useState<F1Standing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const q = query(
      collection(f1Db, F1_COLLECTIONS.STANDINGS),
      where('season', '==', season),
      orderBy('totalPoints', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let standingsData = snapshot.docs.map(doc => doc.data() as F1Standing);
        
        // Filter by subLeague if provided (will be filtered client-side for now)
        // In production, you'd want to do this server-side
        setStandings(standingsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching standings:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [season, subLeagueId]);

  return { standings, loading, error };
}

// ============================================
// useF1UserStanding - Get standing for current user
// ============================================
export function useF1UserStanding(season: number = CURRENT_SEASON) {
  const { user } = useAuth();
  const [standing, setStanding] = useState<F1Standing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const docId = createStandingDocId(user.uid, season);
    const docRef = doc(f1Db, F1_COLLECTIONS.STANDINGS, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setStanding(snapshot.data() as F1Standing);
        } else {
          setStanding(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching user standing:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, season]);

  return { standing, loading, error };
}

// ============================================
// useF1SubLeagues - Get user's subLeagues
// ============================================
export function useF1SubLeagues() {
  const { user } = useAuth();
  const [subLeagues, setSubLeagues] = useState<F1SubLeague[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setSubLeagues([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(f1Db, F1_COLLECTIONS.SUB_LEAGUES),
      where('memberIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subLeaguesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as F1SubLeague));
        setSubLeagues(subLeaguesData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching subLeagues:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  return { subLeagues, loading, error };
}
