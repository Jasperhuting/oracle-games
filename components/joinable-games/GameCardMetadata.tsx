'use client'

import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { GameCardMetadataProps, GameType } from "@/lib/types";

export const GameCardMetadata = ({
  game,
  group,
  participant,
  availableRules,
  onShowRules,
  formatDateTime,
  formatDate,
}: GameCardMetadataProps) => {
  const { t } = useTranslation();
  const isFull = group.maxPlayers && group.totalPlayers >= group.maxPlayers;

  return (
    <>
      {game.description && (
        <p className="text-sm text-gray-600 mb-2">{game.description}</p>
      )}

      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          {availableRules.has(game.gameType as GameType) && (
            <Button
              variant="text"
              size="text"
              onClick={() => onShowRules(game.gameType, group.baseName)}
            >
              {t('games.rules')}
            </Button>
          )}
        </div>
        <div>
          <span className="font-medium">{t('global.year')}:</span> {game.year}
        </div>
        {game.teamSelectionDeadline && (
          <div>
            <span className="font-medium">Deadline:</span> {formatDateTime(game.teamSelectionDeadline)}
          </div>
        )}
        <div>
          <span className="font-medium">{t('global.players')}:</span> {group.totalPlayers}
          {isFull && <span className="text-red-600 ml-1">({t('games.full', 'Full')})</span>}
        </div>
        {group.isMultiDivision && (
          <div>
            <span className="font-medium">{t('global.divisions')}:</span> {group.games.length}
            {participant?.assignedDivision && (
              <span className="text-primary ml-1">
                ({t('global.you')}: {participant.assignedDivision})
              </span>
            )}
          </div>
        )}
        {!group.isMultiDivision && game.division && (
          <div>
            <span className="font-medium">{t('global.division')}:</span> {game.division}
          </div>
        )}
      </div>

      {(game.registrationOpenDate || game.registrationCloseDate) && (
        <div className="mt-2 text-xs text-gray-500">
          {game.registrationOpenDate && (
            <span>{t('games.opens', 'Opens')}: {formatDate(game.registrationOpenDate)}</span>
          )}
          {game.registrationOpenDate && game.registrationCloseDate && <span> • </span>}
          {game.registrationCloseDate && (
            <span>{t('games.closes', 'Closes')}: {formatDate(game.registrationCloseDate)}</span>
          )}
        </div>
      )}
    </>
  );
};
