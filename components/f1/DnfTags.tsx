import { LegacyDriver } from "@/app/f1/types";

interface DnfTagsProps {
    shortNames: string[];
    actualDnfs: string[];
    driversByShortName: Map<string, LegacyDriver>;
}

export const DnfTags = ({
    shortNames,
    actualDnfs,
    driversByShortName,
}: DnfTagsProps) => (
    <div className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-3">
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-2">DNFs</div>
        {shortNames.length > 0 ? (
            <div className="flex flex-wrap gap-2">
                {shortNames.map((shortName) => {
                    const driver = driversByShortName.get(shortName) ?? null;
                    const isCorrect = actualDnfs.includes(shortName);
                    return (
                        <div
                            key={shortName}
                            className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1.5 ${
                                isCorrect
                                    ? 'border-green-500/40 bg-green-500/10 text-green-200'
                                    : 'border-gray-600 bg-gray-900 text-gray-200'
                            }`}
                        >
                            {driver && (
                                <span
                                    style={{ backgroundColor: driver.teamColor || '#666' }}
                                    className="rounded-full overflow-hidden bg-gray-200 w-6 h-6 relative shrink-0"
                                >
                                    <img src={driver.image} alt={driver.lastName} className="w-8 h-auto absolute top-0 left-0" />
                                </span>
                            )}
                            <span className="text-sm font-medium">{shortName}</span>
                        </div>
                    );
                })}
            </div>
        ) : (
            <div className="text-sm text-gray-500">Niet ingevuld</div>
        )}
    </div>
);
