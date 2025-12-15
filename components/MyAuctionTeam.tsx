import { Bid, Rider } from "@/lib/types"
import { formatCurrencyWhole } from "@/lib/utils/formatCurrency";


interface ExtendedBid extends Bid {
    price?: number;
}

export const MyAuctionTeam = ({ myBids, auctionPeriods, availableRiders }: { myBids: ExtendedBid[], auctionPeriods: Array<{ name: string; startDate: string; endDate: string; status: string; neoProfsRequired?: number; neoProfsMaxPoints?: number; neoProfsMaxBudget?: number; }>, availableRiders: any, starterAmount: number }) => {


const periodsColors = ['amber', 'blue', 'green', 'yellow', 'red', 'orange', 'purple', 'pink', 'teal', 'indigo']    

    return <div>
        <span className="flex justify-between">
            <h2 className="text-lg font-bold">My Team (<span>{myBids.length}</span>)</h2>
        </span>
        <div className="mt-2">

            {auctionPeriods?.map((period, index) => {

                const startDate = new Date(period?.startDate)
                const endDate = new Date(period?.endDate)

                const bids = myBids.filter((bid) => {
                    return new Date(bid.bidAt) >= startDate && new Date(bid.bidAt) <= endDate ? bid : null
                })


                if (!bids.length) {
                    return null
                }

                return <div key={period.name} className={`border border-${periodsColors[index % periodsColors.length]}-100 pt-1 bg-${periodsColors[index % periodsColors.length]}-50 rounded-md`}>
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
    </div>
}