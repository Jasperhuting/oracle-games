import { PlayerSelector } from "./PlayerSelector";
import { CountrySelector } from "./CountrySelector";
import { TeamSelector } from "./TeamSelector";
import { ClassSelector } from "./ClassSelector";
import { Toggle } from "./Toggle";

export const ActionPanel = ({
    showPlayerCard,
    setShowPlayerCard,
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
    showPlayerCard?: boolean,
    setShowPlayerCard?: (showPlayerCard: boolean) => void,
    selectedPlayers?: any[],
    setSelectedPlayers?: (selectedPlayers: any[]) => void,
    selectedCountries?: any[],
    setSelectedCountries?: (selectedCountries: any[]) => void,
    selectedTeams?: any[],
    setSelectedTeams?: (selectedTeams: any[]) => void,
    selectedClasses?: any[],
    setSelectedClasses?: (selectedClasses: any[]) => void,
    availablePlayers?: any[]
}) => {
    return (
        <div className="flex bg-white rounded-md flex-row items-center gap-4 p-4">
            {showPlayerCard && setShowPlayerCard && <Toggle status={showPlayerCard} onText="Individual" offText="Team" toggleOn={() => setShowPlayerCard(true)} toggleOff={() => setShowPlayerCard(false)} />}
            {setSelectedPlayers && selectedPlayers && <PlayerSelector setSelectedPlayers={setSelectedPlayers} selectedPlayers={selectedPlayers} multiSelect={true} multiSelectShowSelected={false} items={availablePlayers} />}
            {setSelectedCountries && selectedCountries && <CountrySelector setSelectedCountries={setSelectedCountries} selectedCountries={selectedCountries} multiSelect={true} multiSelectShowSelected={false} />}
            {setSelectedClasses && selectedClasses && <ClassSelector setSelectedClasses={setSelectedClasses} selectedClasses={selectedClasses} multiSelect={true} multiSelectShowSelected={false} />}
            {setSelectedTeams && selectedTeams && <TeamSelector setSelectedTeams={setSelectedTeams} selectedTeams={selectedTeams} multiSelect={true} multiSelectShowSelected={false} />}
        </div>
    );
};