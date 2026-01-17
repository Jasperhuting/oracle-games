import { Check } from "tabler-icons-react"
import { Race } from "../data"
import Link from "next/link"

export const RaceCard = ({ race, selected, done }: { race: Race, selected?: boolean, done?: boolean }) => {
    return <Link href={`/f1/race/${race.round}`} className={`relative bg-gray-800 text-white rounded-md p-3 whitespace-nowrap flex flex-col cursor-pointer hover:bg-gray-700 ${race.name === 'Test Race' && 'pr-10'}`}>
        <span className="font-bold flex flex-row gap-2">
            <span className="text-[10px] bg-gray-600 rounded-full w-5 h-5 inline-flex items-center justify-center tabular-nums">{race.round}</span>
            <span>{race.name}</span>
            <span className="text-[10px] justify-center items-center content-center">{new Date(race.startDate).toLocaleDateString()}-{new Date(race.endDate).toLocaleDateString()}</span>
        </span>
        <span className="text-[10px]">{race.subName}</span>
        {selected && <span className="border border-white absolute inset-1 border-dashed"></span>}
        {done && <span className="text-[10px] absolute right-2 top-2"><Check /></span>}
    </Link>
}