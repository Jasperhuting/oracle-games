'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCompleteness, FIELD_LABELS, OPTIONAL_FIELDS, TOTAL_PROFILE_FIELDS } from '@/lib/profile/completeness';

interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness;
  uid: string;
}

export function ProfileCompletenessCard({
  completeness,
  uid,
}: ProfileCompletenessCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);
  const storageKey = `profileCardDismissed_${uid}`;

  useEffect(() => {
    if (sessionStorage.getItem(storageKey) === '1') {
      setDismissed(true);
    }
  }, [storageKey]);

  // Hide when complete or dismissed
  if (completeness.score === 100 || dismissed) {
    return null;
  }

  const filledCount = TOTAL_PROFILE_FIELDS - completeness.missingFields.length;

  const handleDismiss = () => {
    sessionStorage.setItem(storageKey, '1');
    setDismissed(true);
  };

  const handleNavigate = () => {
    router.push('/account/settings');
  };

  return (
    <div className="mb-6 bg-green-50 border border-green-200 rounded-xl p-4">
      {/* Header row */}
      <div className="flex justify-between mb-3">
        <div>
          <div className="font-bold text-sm text-green-800">
            Maak je profiel compleet
          </div>
          <div className="text-xs text-green-800 mt-px">
            {filledCount} van {TOTAL_PROFILE_FIELDS} velden ingevuld
          </div>
        </div>
        <div className="text-lg font-extrabold text-green-600">
          {completeness.score}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-green-100 rounded-full h-2 overflow-hidden mb-3">
        <div
          className="bg-green-600 h-full rounded-full"
          style={{ width: `${completeness.score}%` }}
        />
      </div>

      {/* Chips row */}
      <div className="flex flex-wrap gap-1.5 mb-[14px]">
        {/* Always shown: hardcoded green chips */}
        <div className="bg-green-600 text-white rounded-full px-[10px] py-[3px] text-[11px] font-medium">
          ✓ Spelersnaam
        </div>
        <div className="bg-green-600 text-white rounded-full px-[10px] py-[3px] text-[11px] font-medium">
          ✓ E-mail
        </div>

        {/* Optional fields */}
        {OPTIONAL_FIELDS.map((field) => {
          const isMissing = completeness.missingFields.includes(field);
          return (
            <div
              key={field}
              className={`rounded-full px-[10px] py-[3px] text-[11px] font-medium ${isMissing ? 'bg-yellow-100 text-yellow-800' : 'bg-green-600 text-white'}`}
            >
              {isMissing ? '+ ' : '✓ '}
              {FIELD_LABELS[field]}
            </div>
          );
        })}
      </div>

      {/* CTA row */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleNavigate}
          className="bg-[#02554d] text-white border-none rounded-lg px-4 py-2 text-[13px] font-semibold cursor-pointer"
        >
          Profiel aanvullen →
        </button>
        <button
          onClick={handleDismiss}
          className="bg-transparent text-gray-500 border-none text-xs cursor-pointer p-2"
        >
          Later
        </button>
      </div>
    </div>
  );
}
