import { Users } from "tabler-icons-react";
import { useRouter } from "next/navigation";

interface Player {
    id: string;
    name: string;
    avatarUrl?: string;
    totalPoints: number;
    correctPredictions: number;
    racesParticipated: number;
    bestFinish: number | null;
    lastRacePoints: number | null;
}

interface PlayerCardProps {
    player: Player;
    position: number;
    hasFinishedRace: boolean;
    shouldPromptAvatar: boolean;
    currentUserId?: string;
    onCompare: (playerId: string) => void;
}

export const PlayerCard = ({
    player,
    position,
    hasFinishedRace,
    shouldPromptAvatar,
    currentUserId,
    onCompare,
}: PlayerCardProps) => {
    const router = useRouter();

    const getPositionStyle = () => {
        if (position === 1) return "bg-gradient-to-r from-yellow-500 to-yellow-400 text-black";
        if (position === 2) return "bg-gradient-to-r from-gray-400 to-gray-300 text-black";
        if (position === 3) return "bg-gradient-to-r from-amber-700 to-amber-600 text-white";
        return "bg-gray-700 text-white";
    };

    const getBorderStyle = () => {
        if (position === 1) return "border-yellow-500";
        if (position === 2) return "border-gray-400";
        if (position === 3) return "border-amber-600";
        return "border-gray-700";
    };

    return (
        <div
            className={`bg-gray-800 rounded-lg p-4 border-l-4 ${getBorderStyle()} cursor-pointer hover:bg-gray-700/50 transition-colors`}
            onClick={() => {
                if (!hasFinishedRace) return;
                if (player.id === currentUserId) return;
                onCompare(player.id);
            }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-full font-black text-sm ${getPositionStyle()}`}>
                        {position}
                    </span>
                    {player.avatarUrl ? (
                        <div className="w-10 h-10 rounded-full overflow-hidden">
                            <img
                                src={player.avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center text-white font-bold text-sm">
                            {player.name.charAt(0).toUpperCase()}
                        </div>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="font-semibold text-white">{player.name}</div>
                            {player.id === currentUserId && (
                                <>
                                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-white">
                                        Jij
                                    </span>
                                    {shouldPromptAvatar && (
                                        <button
                                            type="button"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                router.push("/account/settings");
                                            }}
                                            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-200 hover:bg-amber-500/20"
                                        >
                                            Voeg avatar toe
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="text-xs text-gray-400">{player.racesParticipated} races</div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <div className="text-2xl font-black text-red-400">{player.totalPoints}</div>
                        <div className="text-xs text-gray-400">strafpunten</div>
                    </div>
                    {hasFinishedRace && player.id !== currentUserId && <Users size={18} className="text-gray-500" />}
                </div>
            </div>
            <div className="flex justify-between mt-3 pt-3 border-t border-gray-700 text-sm">
                <div className="text-gray-400">
                    <span className="text-white font-semibold">{player.correctPredictions}</span> correct
                </div>
                {player.lastRacePoints !== null && (
                    <div className="text-gray-400">
                        Laatste: <span className="text-green-400 font-semibold">+{player.lastRacePoints}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
