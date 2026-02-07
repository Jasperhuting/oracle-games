import { Button } from "./Button";
import { Flag } from "./Flag";
import { Row } from "./Row";
import { Minus, Plus } from "tabler-icons-react";

// TODO: replace any with real type
export const PlayerRow = ({ 
    player, 
    selectPlayer, 
    showRank, 
    showPoints, 
    selectedPlayer, 
    fullWidth, 
    index, 
    showButton 
}: { 
    player: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectPlayer: (player: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    showRank?: boolean, 
    showPoints?: boolean, 
    selectedPlayer?: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    fullWidth?: boolean, 
    index: number | boolean, 
    showButton?: boolean 
}) => {
    return (
        <Row
            item={player}
            onSelect={() => {}}
            isSelected={selectedPlayer}
            fullWidth={fullWidth}
            index={index}
            rightContent={
                <>
                    {player?.team?.teamImage && (
                        <img 
                            src={`https://www.procyclingstats.com/${player?.team?.teamImage}`} 
                            alt={player?.team?.name} 
                            style={{ width: '20px' }} 
                        />
                    )}
                    <span className="text-sm text-gray-500 break-keep whitespace-nowrap">
                        {player?.team?.name}
                    </span>
                    {showButton && (
                        <Button 
                            onClick={() => selectPlayer(player)} 
                            selected={selectedPlayer ? true : false} 
                            text={selectedPlayer ? "Verwijder uit je team" : "Voeg toe aan je team"} 
                            endIcon={selectedPlayer ? <Minus color="currentColor" size={20} /> : <Plus color="currentColor" size={20} />} 
                        />
                    )}
                </>
            }
        >
            {showRank && (
                <span className="text-xs mt-1 text-gray-500 justify-center break-keep whitespace-nowrap">
                    #{player?.rank}
                </span>
            )}
            {player?.country && (
                <span className="w-[20px] h-[20px]">
                    <Flag 
                        className="w-[20px] h-[20px] whitespace-nowrap break-keep" 
                        countryCode={player?.country} 
                    />
                </span>
            )}
            <span className="break-keep whitespace-nowrap">{player?.name}</span>
            {showPoints && (
                <span className="text-xs text-gray-500 break-keep whitespace-nowrap">
                    ({player?.points})
                </span>
            )}
        </Row>
    );
};
