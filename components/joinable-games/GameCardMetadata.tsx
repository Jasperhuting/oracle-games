'use client'

import { useTranslation } from "react-i18next";
import { Button } from "../Button";
import { GameCardMetadataProps, GameType, AuctioneerConfig, MarginalGainsConfig, WorldTourManagerConfig } from "@/lib/types";

// Helper to get the game start date from config
const getGameStartDate = (config: AuctioneerConfig | MarginalGainsConfig | WorldTourManagerConfig | undefined): string | undefined => {
  if (!config) return undefined;

  // Check auction periods for start date
  if ('auctionPeriods' in config && config.auctionPeriods && config.auctionPeriods.length > 0) {
    const sortedPeriods = [...config.auctionPeriods].sort((a, b) => {
      const dateA = typeof a.startDate === 'string' ? a.startDate : a.startDate?.toDate?.()?.toISOString();
      const dateB = typeof b.startDate === 'string' ? b.startDate : b.startDate?.toDate?.()?.toISOString();
      return (dateA || '').localeCompare(dateB || '');
    });
    const firstPeriod = sortedPeriods[0];
    if (firstPeriod.startDate) {
      return typeof firstPeriod.startDate === 'string'
        ? firstPeriod.startDate
        : firstPeriod.startDate?.toDate?.()?.toISOString();
    }
  }

  return undefined;
};

// Helper to get counting races from config
const getCountingRaces = (config: AuctioneerConfig | undefined): { raceId: string; raceName: string }[] => {
  if (!config || !('countingRaces' in config) || !config.countingRaces) return [];
  return config.countingRaces;
};

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

  // Get counting races for display
  const countingRaces = game.gameType === 'auctioneer'
    ? getCountingRaces(game.config as AuctioneerConfig)
    : [];

  // Determine races text - for seasonal games show "Heel seizoen", otherwise show counting races
  const isSeasonalGame = game.raceType === 'season';

  // Get game start date
  const gameStartDate = ['auctioneer', 'worldtour-manager', 'marginal-gains'].includes(game.gameType)
    ? getGameStartDate(game.config as AuctioneerConfig | MarginalGainsConfig | WorldTourManagerConfig)
    : undefined;

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
        {gameStartDate && (
          <div>
            <span className="font-medium">{t('games.starts', 'Start')}:</span> {formatDate(gameStartDate)}
          </div>
        )}
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

      {/* Races info - show "Heel seizoen" for seasonal games, or specific counting races */}
      {(isSeasonalGame || countingRaces.length > 0) && (
        <div className="mt-2 text-sm text-gray-600">
          <span className="font-medium">{t('games.races', 'Wedstrijden')}:</span>{' '}
          {isSeasonalGame
            ? t('games.fullSeason', 'Heel seizoen')
            : countingRaces.map(r => r.raceName).join(', ')
          }
        </div>
      )}

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
