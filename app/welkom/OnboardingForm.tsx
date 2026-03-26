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

  const labelClass = 'block mb-1 text-[11px] font-semibold text-gray-500 uppercase tracking-[.05em]';
  const inputClass = 'w-full border border-gray-300 rounded-md px-[10px] py-2 text-[13px]';

  return (
    <div className="max-w-[480px] mx-auto p-6">
      {/* Welcome header */}
      <div className="text-center mb-6">
        <div className="text-[32px] mb-2">👋</div>
        <h1 className="m-0 mb-1.5 text-lg font-bold">Welkom bij Oracle Games!</h1>
        <p className="m-0 text-[13px] text-gray-500">
          Je account is aangemaakt. Maak je profiel even compleet — dit duurt minder dan een minuut.
        </p>
      </div>

      <div className="flex flex-col gap-[14px]">
        {/* Avatar upload */}
        <div className="bg-gray-50 border border-dashed border-gray-300 rounded-[10px] p-4 flex items-center gap-[14px]">
          <AvatarUpload
            currentAvatarUrl={pendingAvatarUrl}
            onUploadSuccess={(url) => setPendingAvatarUrl(url)}
            size={56}
          />
          <div>
            <div className="font-semibold text-[13px] mb-0.5">Profielfoto</div>
            <div className="text-xs text-gray-500">Laat anderen zien wie je bent</div>
          </div>
        </div>

        {/* First name / last name grid */}
        <div className="grid grid-cols-2 gap-[10px]">
          <div>
            <label className={labelClass}>Voornaam</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Jasper"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Achternaam</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Huting"
              className={inputClass}
            />
          </div>
        </div>

        {/* Date of birth */}
        <div>
          <label className={labelClass}>Geboortedatum</label>
          <input
            type="text"
            value={dateOfBirth}
            onChange={(e) => { setDateOfBirth(e.target.value); setDobError(undefined); }}
            placeholder="DD-MM-YYYY"
            className={`w-full border ${dobError ? 'border-red-500' : 'border-gray-300'} rounded-md px-[10px] py-2 text-[13px]`}
          />
          {dobError && (
            <p className="mt-1 text-xs text-red-500">{dobError}</p>
          )}
        </div>

        {/* Language preference */}
        <div>
          <label className={labelClass}>Taal</label>
          <div className="grid grid-cols-2 gap-2">
            <div
              onClick={() => setPreferredLanguage('nl')}
              className={`border-2 ${preferredLanguage === 'nl' ? 'border-[#02554d] bg-green-50' : 'border-gray-200 bg-white'} rounded-lg p-3 text-center cursor-pointer`}
            >
              <div className="text-lg">🇳🇱</div>
              <div className={`text-[13px] font-bold mt-0.5 ${preferredLanguage === 'nl' ? 'text-[#02554d]' : 'text-gray-700'}`}>NL</div>
              <div className={`text-xs mt-px ${preferredLanguage === 'nl' ? 'text-green-800' : 'text-gray-500'}`}>Nederlands</div>
            </div>
            <div
              onClick={() => setPreferredLanguage('en')}
              className={`border-2 ${preferredLanguage === 'en' ? 'border-[#02554d] bg-green-50' : 'border-gray-200 bg-white'} rounded-lg p-3 text-center cursor-pointer`}
            >
              <div className="text-lg">🇬🇧</div>
              <div className={`text-[13px] font-bold mt-0.5 ${preferredLanguage === 'en' ? 'text-[#02554d]' : 'text-gray-700'}`}>EN</div>
              <div className={`text-xs mt-px ${preferredLanguage === 'en' ? 'text-green-800' : 'text-gray-500'}`}>English</div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="flex gap-[10px] mt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className={`flex-1 bg-[#02554d] text-white border-none rounded-lg py-3 text-sm font-semibold ${submitting ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            Opslaan en verder
          </button>
          <button
            type="button"
            onClick={handleLater}
            className="flex-none bg-transparent text-gray-500 border border-gray-200 rounded-lg py-3 px-4 text-sm cursor-pointer"
          >
            Later
          </button>
        </div>

        {saveError && (
          <p className="m-0 text-xs text-red-500 text-center">{saveError}</p>
        )}

        {/* Footer note */}
        <p className="text-center text-[11px] text-gray-400 m-0">
          Je kunt dit altijd later aanpassen via Instellingen
        </p>
      </div>
    </div>
  );
}
