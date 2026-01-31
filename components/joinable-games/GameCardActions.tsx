'use client'

import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import { Button } from "../Button";
import { GameCardActionsProps, JoinableGame, JoinableGameGroup } from "@/lib/types";

export const GameCardActions = ({
  game,
  group,
  joinedGame,
  isAdmin,
  isJoined,
  isWaitingForDivision,
  joinable,
  leaveable,
  isFull,
  isRegistrationOpen,
  isDeadlinePassed,
  joining,
  leaving,
  onJoin,
  onLeave,
  isSelectionBasedGame,
}: GameCardActionsProps) => {
  const { t } = useTranslation();
  const router = useRouter();

  const navigateToGame = (targetGame: JoinableGame) => {
    const path = isSelectionBasedGame(targetGame.gameType)
      ? `/games/${targetGame.id}/auction`
      : `/games/${targetGame.id}/team`;
    router.push(path);
  };

  const navigateToDashboard = (targetGame: JoinableGame, tab?: string) => {
    const url = tab 
      ? `/games/${targetGame.id}/dashboard?tab=${tab}`
      : `/games/${targetGame.id}/dashboard`;
    router.push(url);
  };

  return (
    <div className="ml-4 flex flex-row gap-2 justify-center">
      {/* Admin View Buttons - Not joined */}
      {isAdmin && !isJoined && (
        <AdminViewButtons
          group={group}
          game={game}
          navigateToGame={navigateToGame}
          t={t}
        />
      )}

      {/* Admin View Button - Joined */}
      {isAdmin && isJoined && !isWaitingForDivision && joinedGame && (
        <Button
          text={t('games.viewAllAdmin')}
          onClick={() => navigateToGame(group.isMultiDivision ? group.games[0] : joinedGame)}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
        />
      )}

      {/* Join Button */}
      {joinable && !isAdmin && (
        <Button
          text={joining === game.id ? t('games.joining') : t('games.joinGame')}
          onClick={() => onJoin(game.id)}
          disabled={joining === game.id}
          className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
        />
      )}

      {/* Game Navigation Buttons - Selection based games */}
      {isJoined && !isWaitingForDivision && joinedGame && isSelectionBasedGame(game.gameType) && (
        joinedGame.status === 'active' || joinedGame.status === 'finished' ? (
          <Button
            text={t('games.dashboard', 'Dashboard')}
            onClick={() => navigateToDashboard(joinedGame)}
            className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
          />
        ) : (
          <Button
            text={(game.gameType === 'worldtour-manager' || game.gameType === 'marginal-gains') ? t('games.selection') : t('games.auction')}
            onClick={() => navigateToGame(joinedGame)}
            className="px-4 py-2 bg-primary hover:bg-primary/80 whitespace-nowrap"
          />
        )
      )}

      {/* Game Navigation Buttons - Non-selection based games */}
      {isJoined && !isWaitingForDivision && joinedGame && !isSelectionBasedGame(game.gameType) && (
        <Button
          text={game.gameType === 'slipstream' ? t('games.makePick', 'Make Pick') : game.gameType === 'f1-prediction' ? t('games.predictions', 'Voorspellingen') : t('games.selectTeam')}
          onClick={() => router.push(
            game.gameType === 'slipstream'
              ? `/games/${joinedGame.id}/slipstream`
              : game.gameType === 'f1-prediction'
                ? '/f1'
                : `/games/${joinedGame.id}/team`
          )}
          className="px-4 py-2 bg-green-600 hover:bg-green-600/80 whitespace-nowrap"
        />
      )}

      {/* Dashboard Button - For non-selection based games that are active or finished */}
      {isJoined && !isWaitingForDivision && joinedGame && !isSelectionBasedGame(game.gameType) && game.gameType !== 'slipstream' && (joinedGame.status === 'active' || joinedGame.status === 'finished') && (
        <Button
          text={t('games.dashboard', 'Dashboard')}
          onClick={() => navigateToDashboard(joinedGame)}
          className="px-4 py-2 whitespace-nowrap"
          variant="success"
        />
      )}

      {/* Leave Button */}
      {leaveable && joinedGame && (
        <Button
          text={leaving === joinedGame.id ? t('games.leaving') : t('games.leaveGame')}
          onClick={() => onLeave(joinedGame.id)}
          disabled={leaving === joinedGame.id}
          variant="danger"
          className="px-4 py-2 whitespace-nowrap"
        />
      )}

      {/* Status Messages */}
      {!joinable && !leaveable && !isJoined && isFull && !isAdmin && (
        <span className="text-sm text-red-600">{t('games.gameIsFull')}</span>
      )}
      {!joinable && !isJoined && !isFull && !isRegistrationOpen && isDeadlinePassed && !isAdmin && (
        <span className="text-sm text-gray-500">{t('games.alreadyStarted', 'Reeds begonnen')}</span>
      )}
      {!joinable && !isJoined && !isFull && !isRegistrationOpen && !isDeadlinePassed && !isAdmin && (
        <span className="text-sm text-gray-500">{t('games.registrationClosed')}</span>
      )}
    </div>
  );
};

// Sub-component for admin view buttons
interface AdminViewButtonsProps {
  group: JoinableGameGroup;
  game: JoinableGame;
  navigateToGame: (game: JoinableGame) => void;
  t: (key: string) => string;
}

const AdminViewButtons = ({ group, game, navigateToGame, t }: AdminViewButtonsProps) => {
  if (group.isMultiDivision) {
    return (
      <>
        {group.games.map((divisionGame) => (
          <Button
            key={divisionGame.id}
            text={`${t('games.viewGameAdmin')} - ${divisionGame.division || `Division ${divisionGame.divisionLevel}`}`}
            onClick={() => navigateToGame(divisionGame)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
          />
        ))}
      </>
    );
  }

  return (
    <Button
      text={t('games.viewGameAdmin')}
      onClick={() => navigateToGame(game)}
      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 whitespace-nowrap"
    />
  );
};
