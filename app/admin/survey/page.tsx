'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { SURVEY_QUESTIONS } from '@/lib/constants/survey';
import type { SurveyResponse } from '@/lib/types/survey';

export default function SurveyAdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    fetch(`/api/getUser?userId=${user.uid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.userType === 'admin') setIsAdmin(true);
        else router.push('/home');
      })
      .catch(() => router.push('/home'))
      .finally(() => setChecking(false));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/survey/admin')
      .then((r) => r.json())
      .then((data) => setResponses(data.responses ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAdmin]);

  if (authLoading || checking || !isAdmin) return <p className="p-8 text-center">Laden...</p>;

  const participated = responses.filter((r) => !r.skipped);
  const skipped = responses.filter((r) => r.skipped);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Feedback Survey</h1>
      <p className="text-gray-400 mb-6">
        {participated.length} ingevuld, {skipped.length} overgeslagen
      </p>

      {loading && <p className="text-gray-400">Laden...</p>}

      {!loading && participated.length === 0 && (
        <p className="text-gray-400">Nog geen antwoorden ontvangen.</p>
      )}

      {participated.map((r) => (
        <div key={`${r.userId}_${r.roundId}`} className="border border-gray-700 rounded-xl p-5 mb-4">
          <div className="flex justify-between items-center mb-3">
            <span className="font-semibold">{r.userName}</span>
            <span className="text-xs text-gray-500">
              {r.submittedAt ? new Date(r.submittedAt).toLocaleString('nl-NL') : ''}
            </span>
          </div>
          {SURVEY_QUESTIONS.map((q) => (
            <div key={q.id} className="mb-3">
              <p className="text-xs text-gray-400 mb-1">{q.text}</p>
              <p className="text-sm">{r.answers[q.id] || <span className="text-gray-600">Geen antwoord</span>}</p>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
