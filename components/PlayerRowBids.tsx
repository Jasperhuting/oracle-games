import { formatCurrency, formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Flag } from "./Flag";
import { Row } from "./Row";
import { AuctionGameData as GameData} from "@/lib/types/pages";
import { calculateAge } from "@/lib/utils";
// TODO: replace any with real type

export const PlayerRowBids = ({
    player,
    showRank,
    showPoints,
    showAge,
    selectedPlayer,
    fullWidth,
    index,
    rightContent,
    game
}: {
    player: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectPlayer: (player: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    showRank?: boolean,
    showPoints?: boolean,
    showAge?: boolean,
    selectedPlayer?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    fullWidth?: boolean,
    index: number | boolean,
    showButton?: boolean,
    rightContent?: React.ReactNode
    game?: GameData,
}) => {
    const isSold = player?.isSold;
    const soldTo = player?.soldTo;

    console.log('player', player)

    return (
        <Row
            item={player}
            onSelect={() => { }}
            isSelected={selectedPlayer}
            fullWidth={fullWidth}
            index={index}
            className={isSold ? 'opacity-60 bg-gray-50' : ''}
            rightContent={<>            {showPoints && (
                <span className="text-xs mt-1 text-gray-500 justify-center font-bold w-[80px] break-keep whitespace-nowrap">
                    {game?.gameType === 'marginal-gains' ? 
                        player?.points === 0 ? 1 : `${player?.points} ${player?.points === 1 ? "point" : "points"}` : 
                        player?.points === 0 ? formatCurrencyWhole(1) : formatCurrency(player?.points)}
                </span>
            )}{rightContent}</>}
        >
            {showRank && (
                <span className="text-xs mt-1 text-gray-500 justify-center break-keep whitespace-nowrap min-w-[35px]">
                    #{player?.rank}
                </span>
            )}

            <span className="w-[20px] h-[20px]">
                <Flag
                    className="w-[20px] h-[20px] whitespace-nowrap break-keep"
                    countryCode={player?.country || 'nl'}
                />
            </span>



                <span className={`break-keep whitespace-nowrap ${isSold ? 'line-through' : ''}`}>{player?.name}</span>


                <span className={`text-sm text-gray-500 break-keep whitespace-nowrap w-auto ${isSold ? 'line-through' : ''}`}>
                    {player?.team?.name || '-'}
                </span>

                {showAge && player?.age && (
                    <span className="text-sm text-gray-500 break-keep whitespace-nowrap">
                        | {calculateAge(player.age)} jr
                    </span>
                )}
                {isSold && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium whitespace-nowrap">
                    Sold to {soldTo}
                </span>
            )}
        </Row>
    );
};