import { Bid, Rider } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Collapsible } from "./Collapsible";
import { Star } from "tabler-icons-react";
import { qualifiesAsNeoProf } from "@/lib/utils";
import { AuctionGameData as GameData } from "@/lib/types/pages";

interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionBids = ({ myBids, className, availableRiders, game }: { myBids: ExtendedBid[], className?: string, availableRiders: any, game: GameData }) => {

    

    return <div className={className}>
        <Collapsible title={`My Bids (${myBids.length})`} className="border border-gray-200 rounded-md p-2" defaultOpen={true}>
        <div>
            {myBids.map((bid, idx) => {
                const rider: Rider = availableRiders.find((rider: any) => rider.id === bid.riderNameId || rider.nameID === bid.riderNameId);
                return <div key={bid.id} className={`relative -z-10 flex border rounded-md border-gray-100 px-2 justify-start gap-4 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="flex-1 text-xs truncate absolute bottom-0 text-gray-400 max-w-[170px]">{rider?.team?.name || ''}</span>
                    <span className={`flex-1 ${rider?.team?.name ? 'pb-4' : ''} text-sm pt-1 flex items-center gap-1 whitespace-nowrap`}>
                        {qualifiesAsNeoProf(rider, game?.config || {}) ? <Star size="8" /> : null}
                        {bid.riderName}
                    </span>
                    <span className="w-auto flex justify-end gap-2">
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