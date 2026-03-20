import { LegacyDriver } from "@/app/f1/types";

interface DriverTagProps {
    shortName: string | null;
    label: string;
    actualValue?: string | null;
    driversByShortName: Map<string, LegacyDriver>;
}

export const DriverTag = ({
    shortName,
    label,
    actualValue,
    driversByShortName,
}: DriverTagProps) => {
    const driver = shortName ? driversByShortName.get(shortName) ?? null : null;
    const isCorrect = shortName && actualValue && shortName === actualValue;

    return (
        <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">{label}</div>
            {driver ? (
                <div className="flex items-center gap-3">
                    <span
                        style={{ backgroundColor: driver.teamColor || '#666' }}
                        className="rounded-full overflow-hidden bg-gray-200 w-9 h-9 relative shrink-0"
                    >
                        <img src={driver.image} alt={driver.lastName} className="w-[50px] h-auto absolute top-0 left-0" />
                    </span>
                    <div className="min-w-0">
                        <div className={`font-semibold ${isCorrect ? 'text-green-300' : 'text-white'}`}>{driver.firstName} {driver.lastName}</div>
                        <div className="text-xs text-gray-400">{driver.shortName}</div>
                    </div>
                </div>
            ) : (
                <div className="text-sm text-gray-500">Niet ingevuld</div>
            )}
        </div>
    );
};
