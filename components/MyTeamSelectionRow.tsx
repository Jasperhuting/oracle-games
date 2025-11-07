import { Minus } from "tabler-icons-react";
import { Button } from "./Button";
import { Flag } from "./Flag";

export const MyTeamSelectionRow = ({ rider, removeItem }: { rider: any, removeItem: (rider: any) => void }) => {
    const teamName = typeof rider.team === 'string' ? rider.team : rider.team?.name;
    
    return (
        <div className="flex flex-row items-center justify-between p-2 min-h-[50px]">
            <div className="flex flex-row items-center gap-2">
            <div>
                #{rider.rank}
            </div>
            <div className="flex items-center gap-2">
                <img src={`https://www.procyclingstats.com/${rider.team?.teamImage}`} alt={rider?.name} style={{ width: '30px' }} />    
                <Flag countryCode={rider.country} />
                <span className="whitespace-nowrap">{rider.name}</span>
            </div>
            
            <div>
                <span className="text-sm text-gray-600 whitespace-nowrap">{teamName}</span>
            </div>
            </div>
            <div className="flex flex-row items-center gap-2">
                <span>stage 1</span>
            <Button onClick={() => removeItem(rider)} selected={false} endIcon={<Minus size={20} />} />
            </div>
        </div>
    );
};