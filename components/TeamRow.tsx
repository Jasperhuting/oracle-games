import { Row } from "./Row";

export const TeamRow = ({ 
    team, 
    selectTeam, 
    selectedTeam 
}: { 
    team: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectTeam: (team: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedTeam?: any // eslint-disable-line @typescript-eslint/no-explicit-any 
}) => {
    return (
        <Row
            item={team}
            onSelect={selectTeam}
            isSelected={selectedTeam}
        >
            {team?.teamImage && (
                <span className="w-[20px] h-[20px]">
                    <img 
                        src={`https://www.procyclingstats.com/${team?.teamImage}`} 
                        alt={team?.name} 
                        style={{ width: '30px', height: '30px' }} 
                    />
                </span>
            )}
            <span className="break-keep whitespace-nowrap">{team?.name}</span>
        </Row>
    );
}