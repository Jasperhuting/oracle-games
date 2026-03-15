import { Check, AlertCircle, Clock, Minus } from "tabler-icons-react"
import { F1Race } from "../types"
import Link from "next/link"
const CANCELED_ROUNDS = new Set([4, 5]);

interface RaceCardProps {
    race: F1Race;
    selected?: boolean;
    predictionStatus?: 'none' | 'partial' | 'complete';
}

export const RaceCard = ({ race, selected, predictionStatus = 'none' }: RaceCardProps) => {
    const isCanceled = CANCELED_ROUNDS.has(race.round);
    const isRaceDone = race.status === 'done';
    const isUpcoming = race.status === 'upcoming';
    
    // Determine card styling based on status
    const getCardStyle = () => {
        if (isCanceled) {
            return 'bg-red-950/25 border-l-4 border-red-500 opacity-95';
        }
        if (isRaceDone && predictionStatus === 'complete') {
            // Done + complete = green accent
            return 'bg-gray-800 border-l-4 border-green-500';
        } else if (isRaceDone && predictionStatus === 'partial') {
            // Done + partial = yellow accent (partially completed)
            return 'bg-gray-800 border-l-4 border-yellow-500';
        } else if (isRaceDone && predictionStatus === 'none') {
            // Done + none = red accent (missed)
            return 'bg-gray-800 border-l-4 border-red-500';
        } else if (predictionStatus === 'complete') {
            // Not done but complete = green accent (completed)
            return 'bg-gray-800 border-l-4 border-green-500';
        } else if (predictionStatus === 'partial') {
            // Not done but partial = yellow accent (partially completed)
            return 'bg-gray-800 border-l-4 border-yellow-500';
        } else if (isUpcoming) {
            // Upcoming without prediction = neutral
            return 'bg-gray-800 border-l-4 border-gray-600';
        }
        // Open for predictions
        return 'bg-gray-800 border-l-4 border-yellow-500';
    };

    // Round number badge color
    const getRoundBadgeStyle = () => {
        if (isCanceled) return 'bg-red-700';
        if (isRaceDone && predictionStatus === 'complete') return 'bg-green-600';
        if (isRaceDone && predictionStatus === 'partial') return 'bg-yellow-600';
        if (isRaceDone && predictionStatus === 'none') return 'bg-red-600';
        if (predictionStatus === 'complete') return 'bg-green-600'; // Complete upcoming race
        if (predictionStatus === 'partial') return 'bg-yellow-600'; // Partial upcoming race
        if (isUpcoming) return 'bg-gray-600';
        return 'bg-yellow-600';
    };

    const cardContent = (
        <>
            <span className="font-bold flex flex-row gap-2 items-center">
                <span className={`text-[10px] ${getRoundBadgeStyle()} rounded-full w-5 h-5 inline-flex items-center justify-center tabular-nums`}>
                    {race.round}
                </span>
                <span>{race.name}</span>
                <span className="text-[10px] text-gray-400">
                    {new Date(race.startDate).toLocaleDateString()}-{new Date(race.endDate).toLocaleDateString()}
                </span>
            </span>
            <span className="text-[10px] text-gray-400">{race.subName}</span>
            {isCanceled && (
                <span className="mt-1 inline-flex self-start rounded-full border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-200">
                    Afgelast - telt niet mee
                </span>
            )}
            
            {/* Status indicator */}
            <span className="absolute right-2 top-2">
                {isCanceled && (
                    <AlertCircle size={16} className="text-red-300" />
                )}
                {!isCanceled && predictionStatus === 'complete' && (
                    <Check size={16} className="text-green-400" />
                )}
                {!isCanceled && predictionStatus === 'partial' && (
                    <Minus size={16} className="text-yellow-400" />
                )}
                {!isCanceled && isRaceDone && predictionStatus === 'none' && (
                    <AlertCircle size={16} className="text-red-400" />
                )}
                {!isCanceled && !isRaceDone && !isUpcoming && predictionStatus === 'none' && (
                    <Clock size={16} className="text-yellow-400" />
                )}
            </span>
            
            {selected && <span className={`border-2 absolute inset-0 rounded-md pointer-events-none ${isCanceled ? 'border-red-200' : 'border-white'}`}></span>}
        </>
    );

    if (isCanceled) {
        return (
            <div
                className={`relative text-white rounded-md p-3 whitespace-nowrap flex flex-col cursor-not-allowed ${getCardStyle()} ${race.name === 'Test Race' ? 'pr-10' : ''}`}
                aria-disabled="true"
            >
                {cardContent}
            </div>
        );
    }

    return (
        <Link 
            href={`/f1/race/${race.round}`} 
            className={`relative text-white rounded-md p-3 whitespace-nowrap flex flex-col cursor-pointer hover:bg-gray-700 transition-colors ${getCardStyle()} ${race.name === 'Test Race' ? 'pr-10' : ''}`}
        >
            {cardContent}
        </Link>
    );
}
