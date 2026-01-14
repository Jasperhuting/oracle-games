'use client'

import { useState, useEffect } from "react";
import { PasskeySetup } from "../PasskeySetup";
import { useTranslation } from "react-i18next";

interface SecurityTabProps {
  userId: string;
  email: string;
  displayName: string;
}

interface PasskeyInfo {
  hasPasskey: boolean;
  lastUsedAt?: string;
  createdAt?: string;
}

export const SecurityTab = ({ userId, email, displayName }: SecurityTabProps) => {
  const [passkeyInfo, setPasskeyInfo] = useState<PasskeyInfo>({ hasPasskey: false });
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    const fetchPasskeyInfo = async () => {
      try {
        const passkeyResponse = await fetch(`/api/checkPasskey?userId=${userId}`);
        if (passkeyResponse.ok) {
          const passkeyData = await passkeyResponse.json();
          setPasskeyInfo(passkeyData);
        }
      } catch (error) {
        console.error('Error fetching passkey info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPasskeyInfo();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-600">{t('global.loading')}</div>
      </div>
    );
  }

  return (
    <div>
      {passkeyInfo.hasPasskey ? (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">
                {t('account.passkeyActive')} 🔑
              </h3>
              <div className="mt-2 text-sm text-green-700">
                <p>{t('account.passkeyActiveDescription')}</p>
                {passkeyInfo.lastUsedAt && (
                  <p className="mt-1 text-xs">
                    {t('account.lastUsedAt')}: {new Date(passkeyInfo.lastUsedAt).toLocaleDateString('nl-NL', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <PasskeySetup
          userId={userId}
          email={email}
          displayName={displayName}
        />
      )}
    </div>
  );
};
