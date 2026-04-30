import { Minus, X } from "tabler-icons-react";
import Image from "next/image";
import CurrencyInput from "react-currency-input-field";
import { Button } from "./Button";
import { Flag } from "./Flag";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { GameData } from "@/app/games/[gameId]/auction/page";
import { RiderWithBid } from "@/lib/types";
import { useState } from "react";

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
        onSaveAdjustedBid,
        onCloseAdjustBid,
        hideButton,
        adjustingBid,
        placingBid,
        isWorldTourManager,
        game
    }: {
        rider: RiderWithBid,
        removeItem: (rider: RiderWithBid) => void,
        showStage?: boolean,
        stageText?: string,
        removeAble?: boolean,
        onCancelBid?: (bidId: string, riderName: string) => void,
        onAdjustBid?: (bidId: string) => void,
        onSaveAdjustedBid?: (rider: RiderWithBid, amount: string) => Promise<void> | void,
        onCloseAdjustBid?: () => void,
        hideButton?: boolean,
        adjustingBid?: string | null,
        placingBid?: string | null,
        isWorldTourManager?: boolean,
        game?: GameData
    }) => {
    const [adjustAmount, setAdjustAmount] = useState('');
    const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name;
    // During bidding, only active bids can be cancelled (outbid status only appears after finalization)
    const canCancelBid = rider.myBidStatus === 'active';
    const riderNameId = rider.nameID || rider.id || '';
    const isAdjustingThisBid = adjustingBid === rider.myBidId;

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
                        {!isWorldTourManager && game?.gameType !== 'marginal-gains' && onAdjustBid && onSaveAdjustedBid && isAdjustingThisBid ? (
                            <div className="flex items-center gap-2">
                                <CurrencyInput
                                    id={`adjust-bid-bottom-${rider.myBidId}`}
                                    name={`adjust-bid-bottom-${riderNameId}`}
                                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder={`${rider.myBid || 0}`}
                                    decimalsLimit={0}
                                    disabled={placingBid === riderNameId}
                                    defaultValue={adjustAmount || String(rider.myBid || '')}
                                    onValueChange={(value) => setAdjustAmount(value || '')}
                                />
                                <Button
                                    onClick={async () => {
                                        await onSaveAdjustedBid(rider, adjustAmount || String(rider.myBid || '0'));
                                    }}
                                    selected={false}
                                    text="Save"
                                    variant="primary"
                                    disabled={placingBid === riderNameId}
                                />
                                <Button
                                    onClick={() => {
                                        setAdjustAmount('');
                                        onCloseAdjustBid?.();
                                    }}
                                    selected={false}
                                    text="Cancel"
                                    ghost
                                />
                            </div>
                        ) : (
                            <>
                                {!isWorldTourManager && game?.gameType !== 'marginal-gains' && onAdjustBid && onSaveAdjustedBid && (
                                    <Button
                                        onClick={() => {
                                            setAdjustAmount(String(rider.myBid || ''));
                                            onAdjustBid(rider.myBidId);
                                        }}
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
                            </>
                        )}
                    </div>
                )}

                {!hideButton && removeAble && <Button onClick={() => removeItem(rider)} selected={false} endIcon={<Minus size={20} />} />}
            </div>
        </div>
    );
};
