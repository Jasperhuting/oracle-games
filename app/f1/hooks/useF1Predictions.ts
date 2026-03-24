'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase/client';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
} from 'firebase/firestore';
import { f1Db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  F1Prediction,
  F1_COLLECTIONS,
  createPredictionDocId,
  createRaceDocId,
} from '../types';
import type { SubscriptionQueryResult, SubscriptionWithMutation } from '@/lib/data-fetching/types';

const CURRENT_SEASON = 2026;

// ============================================
// useF1Prediction - Get/save prediction for a race
// ============================================

export interface SavePredictionArgs {
  finishOrder: string[];
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
}

export interface SavePredictionResult {
  success: boolean;
  error?: string;
}

export function useF1Prediction(round: number, season: number = CURRENT_SEASON): SubscriptionWithMutation<F1Prediction | null, SavePredictionArgs, SavePredictionResult> & { prediction: F1Prediction | null; savePrediction: (args: SavePredictionArgs) => Promise<SavePredictionResult>; isAuthenticated: boolean } {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<F1Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [saveError, setSaveError] = useState<Error | null>(null);

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

  const mutate = useCallback(async (data: SavePredictionArgs): Promise<SavePredictionResult> => {
    if (!user?.uid) {
      const authError = 'Not authenticated';
      setSaveError(new Error(authError));
      return { success: false, error: authError };
    }

    setSaving(true);
    setSaveError(null);

    try {
      const raceId = createRaceDocId(season, round);
      const payload = {
        prediction: {
          raceId,
          season,
          round,
          finishOrder: data.finishOrder.slice(0, 10),
          polePosition: data.polePosition,
          fastestLap: data.fastestLap,
          dnf1: data.dnf1,
          dnf2: data.dnf2,
          isLocked: false,
        },
      };

      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (idToken) {
        headers.Authorization = `Bearer ${idToken}`;
      }

      const response = await fetch('/f1/api/predictions', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || 'Failed to save prediction');
      }

      return { success: true };
    } catch (err) {
      console.error('Error saving prediction:', err);
      const nextError = err instanceof Error ? err : new Error('Failed to save prediction');
      setSaveError(nextError);
      return { success: false, error: nextError.message };
    } finally {
      setSaving(false);
    }
  }, [user?.uid, season, round]);

  // savePrediction is a backward-compat alias for mutate
  const savePrediction = mutate;

  return {
    // SubscriptionQueryResult fields
    data: prediction,
    loading,
    error,
    // MutationResult fields
    mutate,
    saving,
    saveError,
    // Backward-compat aliases
    prediction,
    savePrediction,
    isAuthenticated: !!user?.uid,
  };
}

// ============================================
// useF1UserPredictions - Get all predictions for user
// ============================================
export function useF1UserPredictions(season: number = CURRENT_SEASON): SubscriptionQueryResult<F1Prediction[]> & { predictions: F1Prediction[] } {
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

  return { data: predictions, predictions, loading, error };
}
