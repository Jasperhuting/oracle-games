import { Bid, Rider } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Collapsible } from "./Collapsible";
import { Star } from "tabler-icons-react";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { GameData } from "@/app/games/[gameId]/auction/page";

interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionBids = ({ isWorldtour, myBids, className, availableRiders, game }: { isWorldtour:boolean, myBids: ExtendedBid[], className?: string, availableRiders: any, game: GameData }) => {


    return <div className={className}>
        <Collapsible title={`${isWorldtour ? "My selection" : "My Bids"} (${myBids.length})`} className="border border-gray-200 rounded-md p-2" defaultOpen={true}>
        <div>
            {myBids.map((bid, idx) => {
                const rider: Rider = availableRiders.find((rider: any) => rider.id === bid.riderNameId || rider.nameID === bid.riderNameId);
                return <div key={bid.id} className={`relative flex border rounded-md border-gray-100 px-2 justify-start gap-4 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="flex-1 text-xs truncate absolute bottom-0 text-gray-400 max-w-[170px]">{rider?.team?.name || ''}</span>
                    <span className="flex-1 pb-4 text-sm pt-1 flex items-center gap-1">
                        {qualifiesAsNeoProf(rider, game?.config || {}) ? <Star size="8" /> : null}
                        {bid.riderName}
                    </span>
                    <span className="w-auto flex justify-end gap-2">
                        {!isWorldtour ? <span className="text-gray-400 line-through text-xs flex items-center">{formatCurrencyWhole(bid?.price || 0)}</span> : null}
                        <div className="w-[40px] flex justify-end">
                            <span className="text-green-600 font-bold text-xs flex items-center">{formatCurrencyWhole(bid.amount)}</span>
                        </div>
                    </span>
                </div>

            }




            )}
        </div>
        </Collapsible>
    </div>
}