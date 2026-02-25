'use client'

import { useTranslation } from "react-i18next";
import { GameCardBadges } from "./GameCardBadges";
import { GameCardMetadata } from "./GameCardMetadata";
import { GameCardActions } from "./GameCardActions";
import { GameCardProps } from "@/lib/types";
import { useState } from "react";

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
  const [showPrizesModal, setShowPrizesModal] = useState(false);
  
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
      {showPrizesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Sluit prijzen"
            onClick={() => setShowPrizesModal(false)}
          />
          <div className="relative bg-white w-full max-w-lg mx-4 rounded-xl shadow-xl border border-gray-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Prijzen</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                aria-label="Sluit"
                onClick={() => setShowPrizesModal(false)}
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 text-sm text-gray-700 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">1e prijs</div>
                <div>&#39;Bike &amp; Pancakes&#39; arrangement voor 4 personen.</div>
                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src="https://bercbike.nl/wp-content/uploads/2023/02/gravelbike-huren-montferland-1024x683.jpg"
                    alt="1e prijs - Bike & Pancakes arrangement"
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">2e prijs</div>
                <div>Gravel arrangement voor 2 personen.</div>
                <div className="text-xs text-gray-500">(met fietsverhuur, navigatie, helm, bidon, vignet &amp; buffje*)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src="https://bercbike.nl/wp-content/uploads/2021/11/mtb-verhuur-zeddam-montferland.jpg"
                    alt="2e prijs - Gravel arrangement"
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">3e prijs</div>
                <div>&#39;Proefritje&#39; te nuttigen in het wielercafe in Zeddam</div>
                <div className="text-xs text-gray-500">(3 speciaalbiertjes geserveerd met lokale kaas &amp; worst)</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src="https://bercbike.nl/wp-content/uploads/2021/07/achterhoekse-bieren-wielercafe-1024x1024.jpg"
                    alt="3e prijs - Proefritje"
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="font-semibold text-gray-900">4e &amp; 5e prijs</div>
                <div>een &#39;Veloholic&#39; shirt</div>
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <img
                    src="https://res.cloudinary.com/dtkg71eih/image/upload/v1771949728/wielershirt_z4m8wc.jpg"
                    alt="4e en 5e prijs - Veloholic shirt"
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                * Het buffje mag je houden als aandenken aan een leuke sportieve middag!
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPrizesModal(false)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
      <div className={`absolute inset-x-0 top-0 h-1 ${
        isJoined
          ? 'bg-emerald-500'
          : 'bg-gradient-to-r from-emerald-400 via-teal-400 to-blue-400'
      }`} />
      <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-emerald-100/60 blur-2xl" />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
        <div className="min-w-0">
          {/* Header with badges */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2">
            <h3 className="text-lg font-semibold font-serif text-gray-900">{group.baseName}</h3>
            <GameCardBadges
              isJoined={isJoined}
              isWaitingForDivision={!!isWaitingForDivision}
              status={game.status}
              statusLabel={getStatusLabel(game)}
              getStatusBadgeColor={getStatusBadgeColor}
            />
            {game.gameType === 'full-grid' && (
              <>
                <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <span className="whitespace-nowrap">Gesponsord door</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <img src="/berc-bike-logo.jpg" alt="Bercbike" className="h-4 w-4 object-contain" />
                    Berc Bike
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowPrizesModal(true)}
                  className="inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
                >
                  Prijzen
                </button>
              </>
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
          {game.gameType === 'full-grid' && (
            <button
              type="button"
              onClick={() => setShowPrizesModal(true)}
              className="lg:hidden mr-2 inline-flex items-center rounded-full border border-emerald-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
            >
              Prijzen
            </button>
          )}
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
