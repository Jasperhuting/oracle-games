'use client'

import { formatTimestamp, SerializedFirestoreTimestamp } from '@/lib/utils/timestamp';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface RiderScriptStatus {
  dailyLimit: number;
  usedToday: number;
  remaining: number;
  recentActivity: {
    timestamp: SerializedFirestoreTimestamp | string;
    riderName: string;
    year: number;
  }[];
}

interface ScriptsTabProps {
  userId: string;
}

export const ScriptsTab = ({ userId }: ScriptsTabProps) => {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<RiderScriptStatus | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, [userId]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/user/rider-script-status?userId=${userId}`);
      const data = await response.json();

      if (response.ok) {
        setStatus(data);
      } else {
        console.error('Failed to fetch rider script status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching rider script status:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url) {
      setMessage({ type: 'error', text: t('account.scripts.urlRequired') || 'URL is verplicht' });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/user/add-rider', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          setMessage({
            type: 'error',
            text: data.error || t('account.scripts.rateLimitReached') || 'Dagelijkse limiet bereikt',
          });
        } else {
          throw new Error(data.error || 'Failed to add rider');
        }
      } else {
        setMessage({
          type: 'success',
          text: data.message || t('account.scripts.riderAdded') || 'Renner succesvol toegevoegd!',
        });
        setUrl('');
        await fetchStatus();
      }
    } catch (error) {
      console.error('Error adding rider:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : t('account.scripts.errorOccurred') || 'Er is een fout opgetreden',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">
        {t('account.scripts.description') || 'Voeg renners toe aan de rankings door een ProCyclingStats URL in te voeren. Je kunt maximaal 5 renners per dag toevoegen.'}
      </p>

      {/* Status Section */}
      {status && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {t('account.scripts.dailyUsage') || 'Dagelijks gebruik'}:
            </span>
            <span className={`text-sm font-semibold ${status.remaining === 0 ? 'text-red-600' : 'text-green-600'}`}>
              {status.usedToday} / {status.dailyLimit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${status.remaining === 0 ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: `${(status.usedToday / status.dailyLimit) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {status.remaining > 0
              ? t('account.scripts.remainingToday', { count: status.remaining }) || `Nog ${status.remaining} beschikbaar vandaag`
              : t('account.scripts.limitReached') || 'Dagelijkse limiet bereikt. Probeer het morgen opnieuw.'
            }
          </p>
        </div>
      )}

      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-4 rounded ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('account.scripts.procyclingUrl') || 'ProCyclingStats URL'}
          </label>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.procyclingstats.com/rider/titouan-fontaine"
            className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading || (status?.remaining === 0)}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t('account.scripts.urlHelp') || 'Plak de ProCyclingStats URL van de renner'}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || (status?.remaining === 0)}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
        >
          {loading
            ? t('account.scripts.adding') || 'Toevoegen...'
            : t('account.scripts.addRider') || 'Voeg renner toe'
          }
        </button>
      </form>

      {/* Recent Activity */}
      {status && status.recentActivity.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {t('account.scripts.recentActivity') || 'Recente activiteit'}
          </h3>
          <div className="space-y-2">
            {status.recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded text-sm">
                <div>
                  <span className="font-medium text-gray-900">{activity.riderName}</span>
                  <span className="text-gray-500 ml-2">({activity.year})</span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatTimestamp(activity.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
