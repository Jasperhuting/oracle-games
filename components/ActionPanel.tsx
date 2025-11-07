import { PlayerSelector } from "./PlayerSelector";
import { CountrySelector } from "./CountrySelector";
import { TeamSelector } from "./TeamSelector";
import { Toggle } from "./Toggle";

export const ActionPanel = ({ showPlayerCard, setShowPlayerCard, selectedPlayers, setSelectedPlayers, selectedCountries, setSelectedCountries, selectedTeams, setSelectedTeams }: { showPlayerCard: boolean, setShowPlayerCard: (showPlayerCard: boolean) => void, selectedPlayers: any[], setSelectedPlayers: (selectedPlayers: any[]) => void, selectedCountries: any[], setSelectedCountries: (selectedCountries: any[]) => void, selectedTeams: any[], setSelectedTeams: (selectedTeams: any[]) => void }) => {
    return (
        <div className="flex bg-white rounded-md flex-row items-center gap-4 p-4">
            <Toggle status={showPlayerCard} onText="Individueel" offText="Team" toggleOn={() => setShowPlayerCard(true)} toggleOff={() => setShowPlayerCard(false)} />
            <PlayerSelector setSelectedPlayers={setSelectedPlayers} selectedPlayers={selectedPlayers} multiSelect={true} multiSelectShowSelected={false} />
            <CountrySelector setSelectedCountries={setSelectedCountries} selectedCountries={selectedCountries} multiSelect={true} multiSelectShowSelected={false} />
            <TeamSelector setSelectedTeams={setSelectedTeams} selectedTeams={selectedTeams} multiSelect={true} multiSelectShowSelected={false} />
        </div>
    );
};