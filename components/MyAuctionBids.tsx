import { Bid, Rider } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Collapsible } from "./Collapsible";

interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionBids = ({ myBids, className, availableRiders }: { myBids: ExtendedBid[], className?: string, availableRiders: any }) => {


    return <div className={className}>
        <Collapsible title={`My Bids (${myBids.length})`} className="border border-gray-200 rounded-md p-2" defaultOpen={true}>
        <div>
            {myBids.map((bid, idx) => {
                const rider: Rider = availableRiders.find((rider: any) => rider.id === bid.riderNameId || rider.nameID === bid.riderNameId);
                return <div key={bid.id} className={`relative flex border rounded-md border-gray-100 px-2 justify-start gap-4 ${idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="flex-1 text-xs absolute bottom-0 text-gray-400">{rider?.team?.name || ''}</span>
                    <span className="flex-1 pb-4 text-sm pt-1">{bid.riderName}</span>
                    <span className="w-auto flex justify-end gap-2">
                        <span className="text-gray-400 line-through text-xs flex items-center">{formatCurrencyWhole(bid?.price || 0)}</span>
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