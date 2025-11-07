import { Button } from "./Button";
import { Flag } from "./Flag";
import { Minus, Plus } from "tabler-icons-react";

export const PlayerCard = ({ player, onClick, selected }: { player: any, onClick: (player: any) => void, selected: boolean }) => {

    const age = player?.team?.riders?.find((rider: any) => rider.name === player.id)?.age;
    const jerseyImage = player?.team?.teamImage;
    const teamName = player?.team?.name;

    return (
        <div className="bg-white w-full rounded-md p-4 divide-y-2 divide-[#CAC4D0]">

            <div className="flex items-center justify-start gap-5 divide-[#CAC4D0] divide-x-2 pb-2">
                <span className="pr-5">
                    <img src={`https://www.procyclingstats.com/${jerseyImage}`} alt={player?.name} style={{ width: '50px' }} />    
                </span>
                <div className="flex flex-col gap-2">
                    <span className="flex items-end content-end gap-2">
                        <span><Flag width={25} countryCode={player.country} /></span>
                        <span className="font-bold whitespace-nowrap">{player.name}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm">
                        {teamName}
                    </span>
                </div>
            </div>
            <div className="flex flex-col gap-2 text-[#969696] font-medium">
                <div className="flex flex-row gap-2 justify-between mt-2">
                    <span>
                        Leeftijd:
                    </span>
                    <span>
                        {age}
                    </span>
                </div>
                <div className="flex flex-row gap-2 justify-between">
                    <span>
                        Land:
                    </span>
                    <span>
                        {player?.country}
                    </span>
                </div>
                <div className="flex flex-row gap-2 justify-between">
                    <span>
                        Prijs:
                    </span>
                    <span>
                        {new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(player.points)}
                    </span>
                </div>

                <Button className="w-full my-2" onClick={() => onClick(player)} selected={selected} text={selected ? "Verwijder uit je team" : "Voeg toe aan je team"} endIcon={selected ? <Minus color="currentColor" size={20} /> : <Plus color="currentColor" size={20} />} />
            </div>
        </div>
    );
};