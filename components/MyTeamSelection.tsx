import { useState } from "react";
import { MyTeamSelectionRow } from "./MyTeamSelectionRow";
import { ChevronDown, ChevronUp } from "tabler-icons-react";

export const MyTeamSelection = ({ myTeamSelection, setMyTeamSelection, removeAble, onCancelBid, hideButton }: { myTeamSelection: any[], setMyTeamSelection: (myTeamSelection: any[]) => void, removeAble?: boolean, onCancelBid?: (bidId: string, riderName: string) => void, hideButton?: boolean }) => {

    const [open, setOpen] = useState(false);

    const handleToggle = () => {
        setOpen(!open);
    };

    return (
        <div className={`fixed bottom-0 px-4 pt-4 drop-shadow-header right-5 z-50 w-[calc(100%_-_600px)] max-w-[900px] min-w-[600px] bg-white rounded-t-lg border border-gray-200 transition-transform duration-300 ease-in-out ${open ? 'translate-y-0' : 'translate-y-[calc(100%_-_58px)]'}`}>
            <div onClick={handleToggle} className="flex items-center justify-between pb-2 px-2 cursor-pointer">
                <h2 className="text-lg font-bold">My Team</h2>
                <button className="text-gray-500 cursor-pointer">
                    {open ? <ChevronDown /> : <ChevronUp />}
                </button>
            </div>

            <div className="flex flex-col w-full divide-y divide-[#CAC4D0] max-h-[50vh] overflow-y-auto">
                {myTeamSelection?.map((rider) => (
                    <MyTeamSelectionRow
                        key={rider.id}
                        rider={rider}
                        removeItem={(rider) => setMyTeamSelection(myTeamSelection.filter((p) => p.id !== rider.id))}
                        removeAble={removeAble}
                        onCancelBid={onCancelBid}
                        hideButton={hideButton}
                    />
                ))}
            </div>

        </div>
    );
}