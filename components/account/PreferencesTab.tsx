'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface UserPreferences {
  sportInterests: string[];
  gameReminders: boolean;
  emailMarketing: boolean;
  showOnlineStatus: boolean;
}

interface PreferencesTabProps {
  userId: string;
  userData: any;
  setUserData: (data: any) => void;
}

const SPORT_OPTION_KEYS = ['cycling', 'f1', 'football', 'tennis', 'golf', 'other'] as const;

export function PreferencesTab({ userId, userData, setUserData }: PreferencesTabProps) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const preferences: UserPreferences = {
    sportInterests: userData?.sportInterests ?? [],
    gameReminders: userData?.gameReminders ?? true,
    emailMarketing: userData?.emailMarketing ?? true,
    showOnlineStatus: userData?.showOnlineStatus ?? true,
  };

  const updatePreference = async (updates: Partial<UserPreferences>) => {
    const next = { ...preferences, ...updates };
    setSaving(true);
    setSaveStatus('idle');
    try {
      const response = await fetch('/api/account/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...next }),
      });
      if (!response.ok) throw new Error('Failed to save');
      setUserData((prev: any) => ({ ...prev, ...next }));
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const toggleSport = (sport: string) => {
    const current = preferences.sportInterests;
    const next = current.includes(sport)
      ? current.filter(s => s !== sport)
      : [...current, sport];
    updatePreference({ sportInterests: next });
  };

  return (
    <div className="space-y-8">
      {/* Sport interests */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('preferences.sportInterests')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('preferences.sportInterestsDescription')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {SPORT_OPTION_KEYS.map(sport => {
            const active = preferences.sportInterests.includes(sport);
            return (
              <button
                key={sport}
                type="button"
                onClick={() => toggleSport(sport)}
                disabled={saving}
                className={[
                  'px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors text-left',
                  active
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400',
                  saving ? 'opacity-60 cursor-not-allowed' : '',
                ].join(' ')}
              >
                {t(`preferences.sports.${sport}`)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Game reminders */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('preferences.reminders')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('preferences.remindersDescription')}</p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={preferences.gameReminders}
              disabled={saving}
              onChange={e => updatePreference({ gameReminders: e.target.checked })}
            />
            <div className={[
              'w-11 h-6 rounded-full transition-colors',
              preferences.gameReminders ? 'bg-primary' : 'bg-gray-200',
              saving ? 'opacity-60' : '',
            ].join(' ')}>
              <div className={[
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                preferences.gameReminders ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </div>
          </div>
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            {t('preferences.remindersToggle')}
          </span>
        </label>
      </section>

      {/* Email marketing */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-1">{t('preferences.emailUpdates')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('preferences.emailUpdatesDescription')}</p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={preferences.emailMarketing}
              disabled={saving}
              onChange={e => updatePreference({ emailMarketing: e.target.checked })}
            />
            <div className={[
              'w-11 h-6 rounded-full transition-colors',
              preferences.emailMarketing ? 'bg-primary' : 'bg-gray-200',
              saving ? 'opacity-60' : '',
            ].join(' ')}>
              <div className={[
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                preferences.emailMarketing ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </div>
          </div>
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            {t('preferences.emailUpdatesToggle')}
          </span>
        </label>
      </section>

      {/* Online zichtbaarheid */}
      <section>
        <h3 className="text-base font-semibold text-gray-900 mb-1">Online zichtbaarheid</h3>
        <p className="text-sm text-gray-500 mb-4">Kies of andere spelers jou kunnen zien in de lijst met actieve gebruikers.</p>
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={preferences.showOnlineStatus}
              disabled={saving}
              onChange={e => updatePreference({ showOnlineStatus: e.target.checked })}
            />
            <div className={[
              'w-11 h-6 rounded-full transition-colors',
              preferences.showOnlineStatus ? 'bg-primary' : 'bg-gray-200',
              saving ? 'opacity-60' : '',
            ].join(' ')}>
              <div className={[
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
                preferences.showOnlineStatus ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')} />
            </div>
          </div>
          <span className="text-sm text-gray-700 group-hover:text-gray-900">
            Toon mij als online bij andere spelers
          </span>
        </label>
      </section>

      {/* Save status */}
      {saveStatus === 'success' && (
        <p className="text-sm text-green-600">{t('preferences.saved')}</p>
      )}
      {saveStatus === 'error' && (
        <p className="text-sm text-red-600">{t('preferences.saveError')}</p>
      )}
    </div>
  );
}
