import { PlayerSelector } from "./PlayerSelector";
import { CountrySelector } from "./CountrySelector";
import { TeamSelector } from "./TeamSelector";
import { ClassSelector } from "./ClassSelector";
import { ReactNode } from "react";

export const ActionPanel = ({
    toggle,
    selectedPlayers,
    setSelectedPlayers,
    selectedCountries,
    setSelectedCountries,
    selectedTeams,
    setSelectedTeams,
    selectedClasses,
    setSelectedClasses,
    availablePlayers = []
}: {
    toggle?: ReactNode,
    selectedPlayers?: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedPlayers?: (selectedPlayers: any[]) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedCountries?: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedCountries?: (selectedCountries: any[]) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedTeams?: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedTeams?: (selectedTeams: any[]) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedClasses?: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
    setSelectedClasses?: (selectedClasses: any[]) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    availablePlayers?: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
}) => {
    return (
        <div className="flex bg-white rounded-md flex-row items-center gap-4 p-4">
            {toggle}
            {setSelectedPlayers && selectedPlayers && <PlayerSelector setSelectedPlayers={setSelectedPlayers} selectedPlayers={selectedPlayers} multiSelect={true} multiSelectShowSelected={false} items={availablePlayers} />}
            {setSelectedCountries && selectedCountries && <CountrySelector setSelectedCountries={setSelectedCountries} selectedCountries={selectedCountries} multiSelect={true} multiSelectShowSelected={false} />}
            {setSelectedClasses && selectedClasses && <ClassSelector setSelectedClasses={setSelectedClasses} selectedClasses={selectedClasses} multiSelect={true} multiSelectShowSelected={false} />}
            {setSelectedTeams && selectedTeams && <TeamSelector setSelectedTeams={setSelectedTeams} selectedTeams={selectedTeams} multiSelect={true} multiSelectShowSelected={false} />}
        </div>
    );
}