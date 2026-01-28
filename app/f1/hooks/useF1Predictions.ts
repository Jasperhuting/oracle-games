'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  doc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { f1Db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  F1Prediction, 
  F1_COLLECTIONS,
  createPredictionDocId,
  createRaceDocId,
} from '../types';

const CURRENT_SEASON = 2026;

// ============================================
// useF1Prediction - Get/save prediction for a race
// ============================================
export function useF1Prediction(round: number, season: number = CURRENT_SEASON) {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<F1Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const docId = createPredictionDocId(user.uid, season, round);
    const docRef = doc(f1Db, F1_COLLECTIONS.PREDICTIONS, docId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setPrediction(snapshot.data() as F1Prediction);
        } else {
          setPrediction(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching prediction:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, season, round]);

  const savePrediction = useCallback(async (data: {
    finishOrder: string[];
    polePosition: string | null;
    fastestLap: string | null;
    dnf1: string | null;
    dnf2: string | null;
  }) => {
    if (!user?.uid) {
      throw new Error('Not authenticated');
    }

    setSaving(true);
    setError(null);

    try {
      const docId = createPredictionDocId(user.uid, season, round);
      const docRef = doc(f1Db, F1_COLLECTIONS.PREDICTIONS, docId);
      const raceId = createRaceDocId(season, round);

      const now = Timestamp.now();
      const predictionData: F1Prediction = {
        userId: user.uid,
        raceId,
        season,
        round,
        finishOrder: data.finishOrder,
        polePosition: data.polePosition,
        fastestLap: data.fastestLap,
        dnf1: data.dnf1,
        dnf2: data.dnf2,
        submittedAt: prediction?.submittedAt || now,
        updatedAt: now,
        isLocked: false,
      };

      await setDoc(docRef, predictionData, { merge: true });
      return true;
    } catch (err) {
      console.error('Error saving prediction:', err);
      setError(err as Error);
      return false;
    } finally {
      setSaving(false);
    }
  }, [user?.uid, season, round, prediction?.submittedAt]);

  return { 
    prediction, 
    loading, 
    saving, 
    error, 
    savePrediction,
    isAuthenticated: !!user?.uid,
  };
}

// ============================================
// useF1UserPredictions - Get all predictions for user
// ============================================
export function useF1UserPredictions(season: number = CURRENT_SEASON) {
  const { user } = useAuth();
  const [predictions, setPredictions] = useState<F1Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(f1Db, F1_COLLECTIONS.PREDICTIONS),
      where('userId', '==', user.uid),
      where('season', '==', season)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const predictionsData = snapshot.docs.map(doc => doc.data() as F1Prediction);
        setPredictions(predictionsData);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching predictions:', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, season]);

  return { predictions, loading, error };
}
