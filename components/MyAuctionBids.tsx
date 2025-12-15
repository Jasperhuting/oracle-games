import { Bid } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";

interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionBids = ({ myBids, className }: { myBids: ExtendedBid[], className?: string }) => {


    return <div className={className}>
        <span className="flex justify-between">
        <h2 className="text-lg font-bold">My Bids (<span>{myBids.length}</span>)</h2>
        </span>
        <div className="mt-2">
        {myBids.map((bid, index) => (
            <div key={bid.id} className={`flex border border-gray-100 justify-start gap-4 ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
                <span className="w-[60px] flex justify-end">{formatCurrencyWhole(bid.amount)}</span>
                <span className="w-[60px] flex justify-end">{formatCurrencyWhole(bid?.price || 0)}</span>
                <span className="flex-1">{bid.riderName}</span>
            </div>
        ))}
        </div>
    </div>
}