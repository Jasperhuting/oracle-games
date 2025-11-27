import { Minus, X } from "tabler-icons-react";
import { Button } from "./Button";
import { Flag } from "./Flag";
import { formatCurrency } from "@/lib/utils/formatCurrency";

export const MyTeamSelectionRow = ({ rider, removeItem, showStage, stageText, removeAble, onCancelBid, hideButton }: { rider: any, removeItem: (rider: any) => void, showStage?: boolean, stageText?: string, removeAble?: boolean, onCancelBid?: (bidId: string, riderName: string) => void, hideButton?: boolean }) => {
    const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name;

    return (
        <div className="flex flex-row items-center justify-between p-2 min-h-[50px]">
            <div className="flex flex-row items-center gap-4 flex-1">
                <div className="text-gray-500 font-medium">
                    #{rider.rank}
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    {rider.team?.teamImage && <img src={`https://www.procyclingstats.com/${rider.team?.teamImage}`} alt={rider?.name} style={{ width: '30px' }} className="flex-shrink-0" />}
                    <Flag countryCode={rider.country} />
                    <div className="flex flex-col min-w-0">
                        <span className="whitespace-nowrap font-medium">{rider.name}</span>
                        <span className="text-xs text-gray-600 whitespace-nowrap">{teamName}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-row items-center gap-4">
                {/* Show bid and cost information for auction games */}
                {rider.myBid !== undefined && (
                    <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Bid:</span>
                            <span className={`font-bold text-sm ${rider.myBidStatus === 'outbid' ? 'text-red-600' : 'text-green-600'}`}>
                                {formatCurrency(rider.myBid)}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">Cost:</span>
                            <span className={`text-sm font-medium ${rider.effectiveMinBid && rider.effectiveMinBid < rider.points ? 'text-green-600' : 'text-gray-700'}`}>
                                {formatCurrency(rider.effectiveMinBid || rider.points)}
                                {rider.effectiveMinBid && rider.effectiveMinBid < rider.points && (
                                    <span className="text-xs text-gray-400 line-through ml-1">
                                        {formatCurrency(rider.points)}
                                    </span>
                                )}
                            </span>
                        </div>
                        {rider.myBidStatus === 'outbid' && (
                            <span className="text-xs text-red-600 font-medium">Outbid!</span>
                        )}
                    </div>
                )}

                {showStage && <span>{stageText}</span>}

                {/* Show cancel bid button for auction games */}
                {rider.myBid !== undefined && onCancelBid && rider.myBidId && !hideButton && (
                    <Button
                        onClick={() => onCancelBid(rider.myBidId, rider.name)}
                        selected={false}
                        text="Reset bid"
                        endIcon={<X size={20} />}
                        variant="danger"
                        ghost
                    />
                )}

                {!hideButton && removeAble && <Button onClick={() => removeItem(rider)} selected={false} endIcon={<Minus size={20} />} />}
            </div>
        </div>
    );
};