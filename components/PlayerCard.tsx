import { Button } from "./Button";
import { Flag } from "./Flag";
import { Minus, Plus } from "tabler-icons-react";
import { formatCurrency, formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { ReactNode } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ParticipantData } from "@/lib/types";

// TODO: replace any with real type

export const PlayerCard = (
    {
        player,
        onClick,
        selected,
        buttonContainer,
        showBid,
        bid,
        hideInfo,
        className,
        bidders,
        isNeoProf,
        showNeoProfBadge,
        myTeam,
        participant,
        showPointsInsteadOfPrice,
        showRank,
    }: {
        player: any,  // eslint-disable-line @typescript-eslint/no-explicit-any
        onClick: (player: any) => void,  // eslint-disable-line @typescript-eslint/no-explicit-any
        selected: boolean,
        buttonContainer?: ReactNode,
        showBid?: boolean,
        bid?: number,
        hideInfo?: boolean,
        className?: string,
        bidders?: Array<{ playername: string, amount: number, bidAt: string }>,
        isNeoProf?: boolean,
        showNeoProfBadge?: boolean,
        myTeam?: boolean,
        participant?: ParticipantData | null,
        showPointsInsteadOfPrice?: boolean,
        showRank?: boolean,
    }) => {

    // Calculate age from birth date if available
    let age: number | undefined;
    if (player?.age) {
        const ageValue = typeof player.age === 'string' ? player.age : String(player.age);
        // Check if it's a date string (YYYY-MM-DD format)
        if (ageValue.includes('-')) {
            const birthDate = new Date(ageValue);
            const today = new Date();
            let calculatedAge = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                calculatedAge--;
            }
            age = calculatedAge;
        } else {
            // If it's already an age number, use it directly
            age = parseInt(ageValue);
        }
    }

    const jerseyImage = player?.team?.teamImage;
    const teamName = player?.team?.name;
    const isSold = player?.isSold;
    const soldTo = player?.soldTo;
    const isSoldFor = player?.pricePaid;
    
    return (
        <div className={cn("bg-white w-full rounded-md p-4 divide-y-2 divide-[#CAC4D0]", isSold && !myTeam && "opacity-60 bg-gray-50", className)}>        
            <div className="flex items-center justify-start gap-3 divide-[#CAC4D0] divide-x-2 pb-2">
                <span className="pr-0 min-w-[55px]">
                    {jerseyImage ? (
                        <Image
                            src={`https://www.procyclingstats.com/${jerseyImage}`}
                            alt={player?.name}
                            width={50}
                            height={50}
                            className={isSold ? 'opacity-50' : ''}
                        />
                    ) : (
                        <Image
                            src="/jersey-transparent.png"
                            alt={player?.name}
                            width={50}
                            height={50}
                            className={isSold ? 'opacity-50' : ''}
                        />
                    )}
                </span>
                <div className="flex flex-col gap-2 min-w-0 flex-1">
                    <span className="flex items-end content-end gap-2 min-w-0">
                        <span><Flag width={25} countryCode={player.country} /></span>
                        <span className={`font-medium whitespace-nowrap overflow-hidden text-ellipsis ${isSold && !myTeam ? 'line-through' : ''}`}>{player.name}</span>
                        {showNeoProfBadge && isNeoProf && (
                            <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                                Fillers
                            </span>
                        )}
                    </span>
                    <span className={`overflow-hidden text-ellipsis whitespace-nowrap text-sm ${isSold && !myTeam ? 'line-through' : ''}`}>
                        {teamName}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-2 text-[#969696] font-medium">
                {(!hideInfo || showRank) && <div className="flex flex-row gap-2 justify-between mt-2">
                    <span className="font-medium text-gray-700">
                        Rank:
                    </span>
                    <span>
                        {player.rank}
                    </span>
                </div>}
                {!hideInfo && <div className="flex flex-row gap-2 justify-between">
                    <span className="font-medium text-gray-700">
                        Age:
                    </span>
                    <span>
                        {age}
                    </span>
                </div>}
                {!hideInfo && <div className="flex flex-row gap-2 justify-between">
                    <span className="font-medium text-gray-700">
                        Country:
                    </span>
                    <span>
                        <Flag width={25} countryCode={player.country} />
                    </span>
                </div>}

                {isSold ? (
                    <div className="flex flex-row gap-2 justify-between">
                    <span className="font-medium text-gray-700">
                        {showPointsInsteadOfPrice ? 'Points:' : 'Price:'}
                    </span>
                    <span className={`${player.effectiveMinBid && player.effectiveMinBid < player.points ? "text-green-600 font-semibold" : ""} line-through`}>
                        {showPointsInsteadOfPrice ? player.points === 0 ? 1 : player.points : formatCurrencyWhole(player.effectiveMinBid || player.points)}
                        {!showPointsInsteadOfPrice && player.effectiveMinBid && player.effectiveMinBid < player.points && (
                            <span className="text-xs text-gray-500 line-through ml-1">
                                {player.points === 0 ? formatCurrencyWhole(1) : formatCurrencyWhole(player.points)}
                            </span>
                        )}
                    </span>
                </div>
                ) : (
                    <div className="flex flex-row gap-2 justify-between">
                    <span className="font-medium text-gray-700">
                        {showPointsInsteadOfPrice ? 'Points:' : 'Price:'}
                    </span>
                    <span className={player.effectiveMinBid && player.effectiveMinBid < player.points ? "text-green-600 font-semibold" : ""}>
                        {showPointsInsteadOfPrice ? player.points === 0 ? 1 : player.points : formatCurrencyWhole(player.effectiveMinBid || player.points)}
                        {!showPointsInsteadOfPrice && player.effectiveMinBid && player.effectiveMinBid < player.points ? (
                            <span className="text-xs text-gray-500 line-through ml-1">
                                {formatCurrencyWhole(player.points)}
                            </span>
                        ) : <></>}
                    </span>
                </div>
                )}
                
                {showBid && !isSold && !showNeoProfBadge && !showPointsInsteadOfPrice &&
                    <div className="flex flex-row gap-2 justify-between">
                        <span className="font-medium text-gray-700">
                            Bid:
                        </span>
                        <span>
                            {bid ? formatCurrencyWhole(bid) : 'N/A'}
                        </span>
                    </div>
                }
                {showBid && isSold && !showPointsInsteadOfPrice &&
                    <div className="flex flex-row gap-2 justify-between">
                        <span className="font-medium text-gray-700">
                            Winning bid:
                        </span>
                        <span>
                            {isSoldFor ? formatCurrencyWhole(isSoldFor) : 'N/A'}
                        </span>
                    </div>
                }

                {bidders && bidders.length > 0 && (
                    <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-gray-200">
                        <span className="font-medium text-gray-700 text-sm mb-1">
                            Bidders ({bidders.length}):
                        </span>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {bidders.map((bidder, idx) => (
                                <div key={idx} className="flex justify-between items-center text-xs bg-gray-50 px-2 py-1 rounded">
                                    <div className="flex flex-col">
                                    <span className="font-medium text-gray-600">{bidder.playername}</span>
                                    <span className="text-primary font-bold">{formatCurrency(bidder.amount)}</span>
                                    </div>
                                    <span className="text-gray-800">{new Date(bidder.bidAt).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isSold ? (
                    participant?.playername === soldTo ? <></> : <div className="bg-red-100 text-red-700 text-sm font-medium rounded-t-md p-3">Sold to {soldTo}</div>
                ): (buttonContainer ? buttonContainer : <Button className="w-full my-2" onClick={() => onClick(player)} selected={selected} text={selected ? "Verwijder uit je team" : "Voeg toe aan je team"} endIcon={selected ? <Minus color="currentColor" size={20} /> : <Plus color="currentColor" size={20} />} />)}
            </div>
        </div>
    );
};