'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AvatarUpload } from '@/components/account/AvatarUpload';

interface OnboardingFormProps {
  // no props needed — calls router.push internally
}

function convertDateToISO(ddmmyyyy: string): string | undefined {
  const match = ddmmyyyy.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (!match) return undefined;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

export function OnboardingForm({}: OnboardingFormProps) {
  const router = useRouter();

  const [pendingAvatarUrl, setPendingAvatarUrl] = useState<string | undefined>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState<'nl' | 'en'>('nl');
  const [dobError, setDobError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    setSubmitting(true);
    setDobError(undefined);
    setSaveError(undefined);

    const body: Record<string, string> = {};
    if (firstName.trim()) body.firstName = firstName.trim();
    if (lastName.trim()) body.lastName = lastName.trim();
    if (dateOfBirth.trim()) {
      const iso = convertDateToISO(dateOfBirth.trim());
      if (iso) body.dateOfBirth = iso;
      // if not convertible, send raw and let server validate
      else body.dateOfBirth = dateOfBirth.trim();
    }
    body.preferredLanguage = preferredLanguage;
    if (pendingAvatarUrl) body.avatarUrl = pendingAvatarUrl;

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        if (res.status === 400 && data.error?.includes('geboortedatum')) {
          setDobError(data.error);
          return;
        }
        setSaveError('Er is iets misgegaan. Probeer het opnieuw.');
        return;
      }
      router.push('/');
    } catch {
      setSaveError('Er is iets misgegaan. Probeer het opnieuw.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLater = () => {
    const body: Record<string, string> = {};
    if (pendingAvatarUrl) body.avatarUrl = pendingAvatarUrl;
    // Fire-and-forget: persist avatar URL if uploaded, then immediately navigate
    fetch('/api/user/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    router.push('/');
  };

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '24px' }}>
      {/* Welcome header */}
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>👋</div>
        <h1 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>Welkom bij Oracle Games!</h1>
        <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>
          Je account is aangemaakt. Maak je profiel even compleet — dit duurt minder dan een minuut.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Avatar upload */}
        <div style={{ background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <AvatarUpload
            currentAvatarUrl={pendingAvatarUrl}
            onUploadSuccess={(url) => setPendingAvatarUrl(url)}
            size={56}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>Profielfoto</div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Laat anderen zien wie je bent</div>
          </div>
        </div>

        {/* First name / last name grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Voornaam
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jasper"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
              Achternaam
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Huting"
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
            />
          </div>
        </div>

        {/* Date of birth */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Geboortedatum
          </label>
          <input
            type="text"
            value={dateOfBirth}
            onChange={(e) => { setDateOfBirth(e.target.value); setDobError(undefined); }}
            placeholder="DD-MM-YYYY"
            style={{ width: '100%', boxSizing: 'border-box', border: dobError ? '1px solid #ef4444' : '1px solid #d1d5db', borderRadius: '6px', padding: '8px 10px', fontSize: '13px' }}
          />
          {dobError && (
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#ef4444' }}>{dobError}</p>
          )}
        </div>

        {/* Language preference */}
        <div>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Taal
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div
              onClick={() => setPreferredLanguage('nl')}
              style={{ border: preferredLanguage === 'nl' ? '2px solid #02554d' : '2px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center', cursor: 'pointer', background: preferredLanguage === 'nl' ? '#f0fdf4' : 'white' }}
            >
              <div style={{ fontSize: '18px' }}>🇳🇱</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: preferredLanguage === 'nl' ? '#02554d' : '#374151', marginTop: '2px' }}>NL</div>
              <div style={{ fontSize: '12px', color: preferredLanguage === 'nl' ? '#166534' : '#6b7280', marginTop: '1px' }}>Nederlands</div>
            </div>
            <div
              onClick={() => setPreferredLanguage('en')}
              style={{ border: preferredLanguage === 'en' ? '2px solid #02554d' : '2px solid #e5e7eb', borderRadius: '8px', padding: '12px', textAlign: 'center', cursor: 'pointer', background: preferredLanguage === 'en' ? '#f0fdf4' : 'white' }}
            >
              <div style={{ fontSize: '18px' }}>🇬🇧</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: preferredLanguage === 'en' ? '#02554d' : '#374151', marginTop: '2px' }}>EN</div>
              <div style={{ fontSize: '12px', color: preferredLanguage === 'en' ? '#166534' : '#6b7280', marginTop: '1px' }}>English</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            style={{ flex: 1, background: '#02554d', color: 'white', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
          >
            Opslaan en verder
          </button>
          <button
            type="button"
            onClick={handleLater}
            style={{ flex: '0 0 auto', background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', fontSize: '14px', cursor: 'pointer' }}
          >
            Later
          </button>
        </div>

        {saveError && (
          <p style={{ margin: 0, fontSize: '12px', color: '#ef4444', textAlign: 'center' }}>{saveError}</p>
        )}

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: '11px', color: '#9ca3af', margin: 0 }}>
          Je kunt dit altijd later aanpassen via Instellingen
        </p>
      </div>
    </div>
  );
}
