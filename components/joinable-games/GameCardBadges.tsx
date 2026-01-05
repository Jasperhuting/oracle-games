'use client'

import { useTranslation } from "react-i18next";
import { GameCardBadgesProps } from "@/lib/types";

export const GameCardBadges = ({
  isJoined,
  isWaitingForDivision,
  status,
  statusLabel,
  getStatusBadgeColor,
}: GameCardBadgesProps) => {
  const { t } = useTranslation();

  return (
    <>
      {isJoined && !isWaitingForDivision && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary text-white">
          {t('games.joined')}
        </span>
      )}
      {isWaitingForDivision && (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-200 text-yellow-800">
          {t('games.waitingForDivision', 'Waiting for Division Assignment')}
        </span>
      )}
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(status)}`}>
        {t(`games.statuses.${statusLabel}`)}
      </span>
    </>
  );
};
