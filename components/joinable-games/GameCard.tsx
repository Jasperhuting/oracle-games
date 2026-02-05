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

  // Check if deadline has passed (registration closed or team selection deadline passed)
  const now = new Date();
  const registrationCloseDate = game.registrationCloseDate ? new Date(game.registrationCloseDate) : null;
  const teamSelectionDeadline = game.teamSelectionDeadline ? new Date(game.teamSelectionDeadline) : null;
  const isDeadlinePassed = !!(
    (registrationCloseDate && registrationCloseDate < now) ||
    (teamSelectionDeadline && teamSelectionDeadline < now)
  );

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${
        isJoined ? 'border-emerald-200 bg-emerald-50/70' : 'border-slate-200 bg-white/90'
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${
        isJoined
          ? 'bg-emerald-500'
          : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400'
      }`} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/60 blur-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          {/* Header with badges */}
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-lg font-semibold font-serif text-gray-900">{group.baseName}</h3>
            <GameCardBadges
              isJoined={isJoined}
              isWaitingForDivision={!!isWaitingForDivision}
              status={game.status}
              statusLabel={getStatusLabel(game)}
              getStatusBadgeColor={getStatusBadgeColor}
            />
            {game.gameType === 'full-grid' && (
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <span>Gesponsord door</span>
                <span className="inline-flex items-center gap-1">
                  <img src="/berc-bike-logo.jpg" alt="Bercbike" className="h-4 w-4 object-contain" />
                  Bercbike
                </span>
              </span>
            )}
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
        <div className="flex items-start justify-end">
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
            isDeadlinePassed={isDeadlinePassed}
            joining={joining}
            leaving={leaving}
            onJoin={onJoin}
            onLeave={onLeave}
            isSelectionBasedGame={isSelectionBasedGame}
          />
        </div>
      </div>
    </div>
  );
};
