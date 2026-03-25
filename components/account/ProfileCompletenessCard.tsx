'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProfileCompleteness, FIELD_LABELS, FieldKey } from '@/lib/profile/completeness';

interface ProfileCompletenessCardProps {
  completeness: ProfileCompleteness;
}

const OPTIONAL_FIELDS: Exclude<FieldKey, 'playername' | 'email'>[] = [
  'firstName',
  'lastName',
  'avatarUrl',
  'dateOfBirth',
  'preferredLanguage',
];

export function ProfileCompletenessCard({
  completeness,
}: ProfileCompletenessCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('profileCardDismissed') === '1') {
      setDismissed(true);
    }
  }, []);

  // Hide when complete or dismissed
  if (completeness.score === 100 || dismissed) {
    return null;
  }

  const filledCount = 7 - completeness.missingFields.length;

  const handleDismiss = () => {
    sessionStorage.setItem('profileCardDismissed', '1');
    setDismissed(true);
  };

  const handleNavigate = () => {
    router.push('/account/settings');
  };

  return (
    <div
      style={{
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '14px',
              color: '#166534',
            }}
          >
            Maak je profiel compleet
          </div>
          <div
            style={{
              fontSize: '12px',
              color: '#166534',
              marginTop: '1px',
            }}
          >
            {filledCount} van 7 velden ingevuld
          </div>
        </div>
        <div
          style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#16a34a',
          }}
        >
          {completeness.score}%
        </div>
      </div>

      {/* Progress bar */}
      <div
        style={{
          background: '#dcfce7',
          borderRadius: '999px',
          height: '8px',
          overflow: 'hidden',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            background: '#16a34a',
            width: `${completeness.score}%`,
            height: '100%',
            borderRadius: '999px',
          }}
        />
      </div>

      {/* Chips row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          marginBottom: '14px',
        }}
      >
        {/* Always shown: hardcoded green chips */}
        <div
          style={{
            background: '#16a34a',
            color: 'white',
            borderRadius: '999px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          ✓ Spelersnaam
        </div>
        <div
          style={{
            background: '#16a34a',
            color: 'white',
            borderRadius: '999px',
            padding: '3px 10px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          ✓ E-mail
        </div>

        {/* Optional fields */}
        {OPTIONAL_FIELDS.map((field) => {
          const isMissing = completeness.missingFields.includes(field);
          return (
            <div
              key={field}
              style={{
                background: isMissing ? '#fef9c3' : '#16a34a',
                color: isMissing ? '#854d0e' : 'white',
                borderRadius: '999px',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: 500,
              }}
            >
              {isMissing ? '+ ' : '✓ '}
              {FIELD_LABELS[field]}
            </div>
          );
        })}
      </div>

      {/* CTA row */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <button
          onClick={handleNavigate}
          style={{
            background: '#02554d',
            color: 'white',
            border: 'none',
            borderRadius: '7px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Profiel aanvullen →
        </button>
        <button
          onClick={handleDismiss}
          style={{
            background: 'transparent',
            color: '#6b7280',
            border: 'none',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '8px',
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}
