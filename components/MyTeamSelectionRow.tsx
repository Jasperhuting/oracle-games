import { Minus, X } from "tabler-icons-react";
import Image from "next/image";
import { Button } from "./Button";
import { Flag } from "./Flag";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { GameData } from "@/app/games/[gameId]/auction/page";

// TODO: replace any with real type
export const MyTeamSelectionRow = (
    {
        rider,
        removeItem,
        showStage,
        stageText,
        removeAble,
        onCancelBid,
        onAdjustBid,
        hideButton,
        adjustingBid,
        isWorldTourManager,
        game
    }: {
        rider: any,  // eslint-disable-line @typescript-eslint/no-explicit-any
        removeItem: (rider: any) => void,  // eslint-disable-line @typescript-eslint/no-explicit-any
        showStage?: boolean,
        stageText?: string,
        removeAble?: boolean,
        onCancelBid?: (bidId: string, riderName: string) => void,
        onAdjustBid?: (bidId: string) => void,
        hideButton?: boolean,
        adjustingBid?: string | null,
        isWorldTourManager?: boolean,
        game?: GameData
    }) => {
    const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name;
    // During bidding, only active bids can be cancelled (outbid status only appears after finalization)
    const canCancelBid = rider.myBidStatus === 'active';

    return (
        <div className="flex flex-row items-center justify-between p-2 min-h-[50px]">
            <div className="flex flex-row items-center gap-4 flex-1">
                <div className="text-gray-500 font-medium">
                    #{rider.rank}
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {rider.team?.teamImage && (
                        <Image
                            src={`https://www.procyclingstats.com/${rider.team?.teamImage}`}
                            alt={rider?.name}
                            width={30}
                            height={30}
                            className="flex-shrink-0"
                        />
                    )}
                    <Flag countryCode={rider.country} />
                    <div className="flex flex-col min-w-0">
                        <span className="whitespace-nowrap font-medium">{rider.name}</span>
                        <span className="text-xs text-gray-600 whitespace-nowrap">{teamName}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-row items-center gap-4">
                {/* Show bid and cost information for auction games (without revealing outbid status live) */}
                {rider.myBid !== undefined && (
                    <div className="flex flex-col items-end gap-1">
                        {game?.gameType !== 'worldtour-manager' && game?.gameType !== 'marginal-gains' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Bid:</span>
                                <span className="font-bold text-sm text-green-600">
                                    {formatCurrency(rider.myBid)}
                                </span>
                            </div>)}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">{game?.gameType === 'marginal-gains' ? 'Points:' : 'Cost:'}</span>
                            <span className={`text-sm font-medium ${rider.effectiveMinBid && rider.effectiveMinBid < rider.points ? 'text-green-600' : 'text-gray-700'}`}>
                                {game?.gameType === 'marginal-gains' ? rider.myBid : formatCurrency(rider.effectiveMinBid || rider.points)}
                                {game?.gameType !== 'marginal-gains' && rider.effectiveMinBid && rider.effectiveMinBid < rider.points && (
                                    <span className="text-xs text-gray-400 line-through ml-1">
                                        {formatCurrency(rider.points)}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {showStage && <span>{stageText}</span>}

                {/* Show adjust and cancel bid buttons for auction games - only for active/outbid bids */}
                {rider.myBid !== undefined && onCancelBid && rider.myBidId && !hideButton && canCancelBid && (
                    <div className="flex gap-2">
                        {!isWorldTourManager && game?.gameType !== 'marginal-gains' && onAdjustBid && (
                            <Button
                                onClick={() => onAdjustBid(rider.myBidId)}
                                selected={false}
                                text="Adjust bid"
                                variant="primary"
                                ghost
                            />
                        )}
                        <Button
                            onClick={() => onCancelBid(rider.myBidId, rider.name)}
                            selected={false}
                            text={game?.gameType === 'marginal-gains' || game?.gameType === 'worldtour-manager' ? 'Remove' : 'Reset bid'}
                            endIcon={<X size={20} />}
                            variant="danger"
                            ghost
                        />
                    </div>
                )}

                {!hideButton && removeAble && <Button onClick={() => removeItem(rider)} selected={false} endIcon={<Minus size={20} />} />}
            </div>
        </div>
    );
};