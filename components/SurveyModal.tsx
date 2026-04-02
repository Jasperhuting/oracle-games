'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/hooks/useAuth';
import { useSurveyStatus } from '@/hooks/useSurveyStatus';
import { SURVEY_QUESTIONS, SURVEY_ROUND_ID } from '@/lib/constants/survey';
import type { SurveyAnswers } from '@/lib/types/survey';

const QUESTIONS_PER_PAGE = 2;

export function SurveyModal() {
  const { user } = useAuth();
  const { shouldShow, loading } = useSurveyStatus(user?.uid);
  const [visible, setVisible] = useState(true);
  const [delayed, setDelayed] = useState(false);
  const [page, setPage] = useState(0);
  const [answers, setAnswers] = useState<SurveyAnswers>({ q1: '', q2: '', q3: '', q4: '', q5: '', q6: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDelayed(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (loading || !shouldShow || !visible || !delayed || !user) return null;

  const totalPages = Math.ceil(SURVEY_QUESTIONS.length / QUESTIONS_PER_PAGE);
  const currentQuestions = SURVEY_QUESTIONS.slice(
    page * QUESTIONS_PER_PAGE,
    (page + 1) * QUESTIONS_PER_PAGE
  );
  const isLastPage = page === totalPages - 1;

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email || 'Onbekend',
          roundId: SURVEY_ROUND_ID,
          skipped: true,
          answers: { q1: '', q2: '', q3: '', q4: '', q5: '', q6: '' },
        }),
      });
    } catch {
      // Stille fout: popup sluiten ook als opslaan mislukt
    } finally {
      setSubmitting(false);
      setVisible(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          userName: user.displayName || user.email || 'Onbekend',
          roundId: SURVEY_ROUND_ID,
          skipped: false,
          answers,
        }),
      });
      if (res.ok) {
        toast.success('Bedankt voor je feedback!');
        setVisible(false);
      } else {
        toast.error('Opslaan mislukt, probeer het later opnieuw.');
      }
    } catch {
      toast.error('Opslaan mislukt, probeer het later opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--platform-card-bg,#1a1a2e)] rounded-xl max-w-lg w-full p-6 shadow-2xl">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold">Help ons de website verbeteren</h2>
            <p className="text-sm text-gray-400 mt-1">Duurt maar 2 minuten. Je kunt ook overslaan.</p>
          </div>
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="text-gray-500 hover:text-gray-300 text-2xl leading-none ml-4"
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <div className="border-t border-gray-700 mb-5" />

        {currentQuestions.map((q, i) => (
          <div key={q.id} className="mb-5">
            <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-wide">
              Vraag {page * QUESTIONS_PER_PAGE + i + 1} van {SURVEY_QUESTIONS.length}
            </p>
            <p className="font-medium mb-2">{q.text}</p>
            <textarea
              value={answers[q.id]}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              placeholder={q.placeholder}
              disabled={submitting}
              className="w-full bg-black/30 border border-gray-700 rounded-lg p-3 text-sm resize-y min-h-[80px] focus:outline-none focus:border-blue-500"
            />
          </div>
        ))}

        <div className="flex justify-between items-center mt-2">
          <button
            onClick={handleSkip}
            disabled={submitting}
            className="text-sm text-gray-500 hover:text-gray-300 border border-gray-700 rounded-lg px-4 py-2"
          >
            Overslaan, doe niet mee
          </button>
          <div className="flex gap-2">
            {page > 0 && (
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={submitting}
                className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm"
              >
                Vorige
              </button>
            )}
            {isLastPage ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm"
              >
                {submitting ? 'Versturen...' : 'Verstuur'}
              </button>
            ) : (
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg px-5 py-2 text-sm"
              >
                Volgende
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-1.5 justify-center mt-4">
          {Array.from({ length: totalPages }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-7 rounded-full transition-colors ${i <= page ? 'bg-blue-500' : 'bg-gray-700'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
