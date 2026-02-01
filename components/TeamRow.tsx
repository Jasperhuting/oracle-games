import { Row } from "./Row";

export const TeamRow = ({ 
    team, 
    selectTeam, 
    selectedTeam,
    showRiderCount = false,
    riderCount = 0
}: { 
    team: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectTeam: (team: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
    selectedTeam?: any, // eslint-disable-line @typescript-eslint/no-explicit-any 
    showRiderCount?: boolean,
    riderCount?: number
}) => {
    return (
        <Row
            item={team}
            onSelect={selectTeam}
            isSelected={selectedTeam}
        >
            {team?.teamImage && (
                <span className="w-[20px] h-[20px] flex-shrink-0">
                    <img 
                        src={`https://www.procyclingstats.com/${team?.teamImage}`} 
                        alt={team?.name} 
                        style={{ width: '30px', height: '30px' }} 
                    />
                </span>
            )}
            <span className="break-keep whitespace-nowrap truncate max-w-[200px]">{team?.name?.replace(/\s*\d{4}$/, '')}</span>
            {showRiderCount && (
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded ml-2 flex-shrink-0">
                    {riderCount}
                </span>
            )}
        </Row>
    );
}