'use client'

import { useTranslation } from "react-i18next";
import { GameCardBadges } from "./GameCardBadges";
import { GameCardMetadata } from "./GameCardMetadata";
import { GameCardActions } from "./GameCardActions";
import { GameCardProps } from "@/lib/types";

export const GameCard = ({
  group,
  myGames,
  myParticipants,
  isAdmin,
  availableRules,
  joining,
  leaving,
  onJoin,
  onLeave,
  onShowRules,
  isRegistrationOpen,
  canJoin,
  canLeave,
  isSelectionBasedGame,
  getStatusLabel,
  getStatusBadgeColor,
  formatDate,
  formatDateTime,
}: GameCardProps) => {
  const { t } = useTranslation();
  
  // Use first game as representative for the group
  const game = group.games[0];

  // Check if user has joined ANY division in this group
  const joinedGame = group.games.find(g => myGames.has(g.id));
  const isJoined = !!joinedGame;
  const participant = joinedGame ? myParticipants.get(joinedGame.id) : undefined;
  const isWaitingForDivision = isJoined && participant && !participant.divisionAssigned;

  // Determine if user can join/leave
  const joinable = group.isMultiDivision
    ? !isJoined && isRegistrationOpen(game) && (!group.maxPlayers || group.totalPlayers < group.maxPlayers)
    : canJoin(game);
  const leaveable = joinedGame ? canLeave(joinedGame) : false;
  const isFull = !!(group.maxPlayers && group.totalPlayers >= group.maxPlayers);

  return (
    <div
      className={`bg-white border rounded-lg p-4 ${
        isJoined ? 'border-primary bg-primary' : 'border-gray-200'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header with badges */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold">{group.baseName}</h3>
            <GameCardBadges
              isJoined={isJoined}
              isWaitingForDivision={!!isWaitingForDivision}
              status={game.status}
              statusLabel={getStatusLabel(game)}
              getStatusBadgeColor={getStatusBadgeColor}
            />
          </div>

          {/* Metadata */}
          <GameCardMetadata
            game={game}
            group={group}
            participant={participant}
            availableRules={availableRules}
            onShowRules={onShowRules}
            formatDateTime={formatDateTime}
            formatDate={formatDate}
          />

          {/* Waiting for division notice */}
          {isWaitingForDivision && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              {t('games.pendingDivisionAssignment', 'Your registration is pending. The admin will assign you to a division soon.')}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <GameCardActions
          game={game}
          group={group}
          joinedGame={joinedGame}
          isAdmin={isAdmin}
          isJoined={isJoined}
          isWaitingForDivision={!!isWaitingForDivision}
          joinable={joinable}
          leaveable={leaveable}
          isFull={isFull}
          isRegistrationOpen={isRegistrationOpen(game)}
          joining={joining}
          leaving={leaving}
          onJoin={onJoin}
          onLeave={onLeave}
          isSelectionBasedGame={isSelectionBasedGame}
        />
      </div>
    </div>
  );
};
