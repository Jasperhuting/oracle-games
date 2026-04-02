'use client';

import { useEffect, useState } from 'react';

export function useSurveyStatus(userId: string | undefined) {
  const [shouldShow, setShouldShow] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetch('/api/survey/status')
      .then((r) => r.json())
      .then((data) => {
        setShouldShow(!data.hasResponded);
      })
      .catch(() => {
        setShouldShow(false);
      })
      .finally(() => {
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return { shouldShow, loading };
}
