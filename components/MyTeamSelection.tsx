import { useState } from "react";
import { MyTeamSelectionRow } from "./MyTeamSelectionRow";
import { ChevronDown, ChevronUp } from "tabler-icons-react";
import { GameData } from "@/app/games/[gameId]/auction/page";

// TODO: replace any with real type
export const MyTeamSelection = (
    { 
        myTeamSelection, 
        setMyTeamSelection, 
        removeAble, 
        onCancelBid,
        onAdjustBid, 
        hideButton,
        adjustingBid,
        isWorldTourManager,
        game,
    }: { 
        myTeamSelection: any[],  // eslint-disable-line @typescript-eslint/no-explicit-any
        setMyTeamSelection: (myTeamSelection: any[]) => void,  // eslint-disable-line @typescript-eslint/no-explicit-any
        removeAble?: boolean, 
        onCancelBid?: (bidId: string, riderName: string) => void,
        onAdjustBid?: (bidId: string) => void, 
        hideButton?: boolean,
        adjustingBid?: string | null,
        isWorldTourManager?: boolean,
        game?: GameData
    }) => {

    const [open, setOpen] = useState(false);

    const handleToggle = () => {
        setOpen(!open);
    };

    return (
        <div className={`fixed bottom-0 px-3 pt-4 right-15 z-50 w-[calc(100%_-_600px)] max-w-[900px] min-w-[600px] transition-transform duration-300 ease-in-out ${open ? 'translate-y-0' : 'translate-y-[calc(100%_-_58px)]'}`}>
            <div className="flex flex-col w-full drop-shadow-header">
                <div onClick={handleToggle} className="flex bg-white rounded-t-lg cursor-pointer items-center justify-self-end gap-2 pb-2 px-2 pt-2 w-fit self-end">
                    <h3 className="text-md font-bold">{game?.gameType === 'worldtour-manager' || game?.gameType === 'marginal-gains' ? 'My Selection' : 'My Bids'}</h3>
                    <button className="text-gray-500 cursor-pointer">
                        {open ? <ChevronDown /> : <ChevronUp />}
                    </button>
                </div>

                <div className="flex flex-col w-full divide-y bg-white rounded-tl-lg border border-gray-200 divide-[#CAC4D0] max-h-[50vh] overflow-y-auto">
                    {myTeamSelection?.map((rider) => (
                        <MyTeamSelectionRow
                            key={rider.id}
                            rider={rider}
                            removeItem={(rider) => setMyTeamSelection(myTeamSelection.filter((p) => p.id !== rider.id))}
                            removeAble={removeAble}
                            onCancelBid={onCancelBid}
                            onAdjustBid={onAdjustBid}
                            hideButton={hideButton}
                            adjustingBid={adjustingBid}
                            game={game}
                            isWorldTourManager={isWorldTourManager}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}