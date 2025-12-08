import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "./Button";
import { Flag } from "./Flag";
import { Row } from "./Row";
import { Minus, Plus } from "tabler-icons-react";

export const PlayerRowBids = ({
    player,
    showRank,
    showPoints,
    selectedPlayer,
    fullWidth,
    index,
    rightContent
}: {
    player: any,
    selectPlayer: (player: any) => void,
    showRank?: boolean,
    showPoints?: boolean,
    selectedPlayer?: any,
    fullWidth?: boolean,
    index: number | boolean,
    showButton?: boolean,
    rightContent?: React.ReactNode
}) => {
    const isSold = player?.isSold;
    const soldTo = player?.soldTo;

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
                    {formatCurrency(player?.points)}
                </span>
            )}{rightContent}</>}
        >
            {showRank && (
                <span className="text-xs mt-1 text-gray-500 justify-center break-keep whitespace-nowrap">
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
                    {player?.team?.name}
                </span>
                {isSold && (
                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-medium whitespace-nowrap">
                    Sold to {soldTo}
                </span>
            )}
        </Row>
    );
};