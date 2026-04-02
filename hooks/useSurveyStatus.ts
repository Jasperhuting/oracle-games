'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { SURVEY_ROUND_ID } from '@/lib/constants/survey';

export function useSurveyStatus(userId: string | undefined) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const docId = `${userId}_${SURVEY_ROUND_ID}`;
    getDoc(doc(db, 'survey_responses', docId))
      .then((snap) => {
        setShouldShow(!snap.exists());
      })
      .catch(() => {
        setShouldShow(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [userId]);

  return { shouldShow, loading };
}
