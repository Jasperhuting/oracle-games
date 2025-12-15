import { Bid, Rider } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";
import { Collapsible } from "./Collapsible";


interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionTeam = ({ myBids, auctionPeriods, availableRiders }: { myBids: ExtendedBid[], auctionPeriods: Array<{ name: string; startDate: string; endDate: string; status: string; neoProfsRequired?: number; neoProfsMaxPoints?: number; neoProfsMaxBudget?: number; }>, availableRiders: any, starterAmount: number }) => {


const periodsColors = [{
    border:  'border-amber-100',
    bg: 'bg-amber-50'
}, {
    border: 'border-blue-100',
    bg: 'bg-blue-50'
}, {
    border: 'border-green-100',
    bg: 'bg-green-50'
},{
    border: 'border-yellow-100',
    bg: 'bg-yellow-50'
},{
    border: 'border-red-100',
    bg: 'bg-red-50'
},{
    border: 'border-orange-100',
    bg: 'bg-orange-50'
},{
    border: 'border-purple-100',
    bg: 'bg-purple-50'
},{
    border: 'border-pink-100',
    bg: 'bg-pink-50'
},{
    border: 'border-teal-100',
    bg: 'bg-teal-50'
},{
    border: 'border-indigo-100',
    bg: 'bg-indigo-50'
}]

    return <Collapsible title={`My Team (${myBids.length})`} className="border border-gray-200 rounded-md p-2" defaultOpen={true}>
        <div>

            {auctionPeriods?.map((period, index) => {

                const startDate = new Date(period?.startDate)
                const endDate = new Date(period?.endDate)

                const bids = myBids.filter((bid) => {
                    return new Date(bid.bidAt) >= startDate && new Date(bid.bidAt) <= endDate ? bid : null
                })


                if (!bids.length) {
                    return null
                }

                return <div key={period.name} className={`border ${periodsColors[index].border} pt-1 ${periodsColors[index].bg} rounded-md`}>
                    <span className="font-bold p-2 text-sm">Period {index + 1}</span>

                    {bids.map((bid, idx) => {

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
                    })}
                </div>
            })}

        </div>
    </Collapsible>
}