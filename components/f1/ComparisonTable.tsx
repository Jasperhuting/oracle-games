import { LegacyDriver } from "@/app/f1/types";

interface ComparePositionRow {
    driver: LegacyDriver | null;
    predictedPos: number;
    actualPos: number | null;
    penalty: number;
    isDnf: boolean;
}

interface ComparisonTableProps {
    title: string;
    playerName: string;
    points: number | null;
    rows: ComparePositionRow[];
}

export const ComparisonTable = ({
    title,
    playerName,
    points,
    rows,
}: ComparisonTableProps) => (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="relative px-4 py-4 border-b border-gray-700">
            <div className="absolute top-0 left-0 right-0 h-1 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iOCIgdmlld0JveD0iMCAwIDE2IDgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjgiIGhlaWdodD0iOCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSI4IiB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSJibGFjayIvPjwvc3ZnPg==')]"></div>
            <div className="flex flex-col gap-2 pt-1 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                    <h3 className="text-white font-black text-base tracking-tight uppercase">{title}</h3>
                    <div className="w-1 h-6 bg-red-600 rounded-full"></div>
                </div>
                <div className="text-sm text-gray-400">
                    <span className="text-white font-semibold">{playerName}</span>
                    <span className="ml-2 text-red-400 font-black">{points ?? '-'}</span>
                    <span className="ml-1">strafpunten</span>
                </div>
            </div>
        </div>

        {rows.length > 0 ? (
            <div className="overflow-x-auto xl:overflow-visible">
                <table className="w-full table-fixed min-w-[640px] xl:min-w-0">
                    <thead className="bg-black/30">
                        <tr>
                            <th className="w-[96px] px-3 py-3 text-left text-[11px] font-bold text-gray-300 uppercase tracking-wider">Voorspeld</th>
                            <th className="px-3 py-3 text-left text-[11px] font-bold text-gray-300 uppercase tracking-wider">Coureur</th>
                            <th className="w-[92px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Werkelijk</th>
                            <th className="w-[110px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Verschil</th>
                            <th className="w-[118px] px-3 py-3 text-center text-[11px] font-bold text-gray-300 uppercase tracking-wider">Strafpunten</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {rows.map(({ driver, predictedPos, actualPos, penalty, isDnf }) => {
                            const rowColor = penalty === 0
                                ? 'bg-green-950/35'
                                : penalty >= 10
                                    ? 'bg-red-950/35'
                                    : 'bg-yellow-950/25';

                            return (
                                <tr key={`${title}-${driver?.shortName ?? predictedPos}`} className={rowColor}>
                                    <td className="px-3 py-2.5">
                                        <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-gray-800 border border-gray-600 px-2 text-sm font-black text-white">
                                            P{predictedPos}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5">
                                        {driver ? (
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <span
                                                    style={{ backgroundColor: driver.teamColor || '#666' }}
                                                    className="rounded-full overflow-hidden bg-gray-200 w-[34px] h-[34px] relative shrink-0"
                                                >
                                                    <img src={driver.image} alt={driver.lastName} className="w-[46px] h-auto absolute top-0 left-0" />
                                                </span>
                                                <div className="min-w-0">
                                                    <div className="truncate font-semibold text-white text-[15px] leading-tight">{driver.firstName} {driver.lastName}</div>
                                                    <div className="text-xs text-gray-400">{driver.shortName}</div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="font-semibold text-white">Onbekende coureur</div>
                                                <div className="text-xs text-gray-400">Niet gevonden</div>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`font-semibold text-[15px] ${actualPos && actualPos <= 10 ? 'text-white' : 'text-amber-400'}`}>
                                            {isDnf ? 'DNF' : actualPos ? `P${actualPos}` : 'Niet geklasseerd'}
                                        </span>
                                    </td>
                                    <td className="px-3 py-2.5 text-center text-sm text-gray-300">
                                        {isDnf ? 'uitgevallen' : actualPos === null ? '-' : penalty === 0 ? 'exact' : `${penalty} plaatsen`}
                                    </td>
                                    <td className="px-3 py-2.5 text-center">
                                        <span className={`inline-flex min-w-11 justify-center rounded-full px-2 py-1 text-sm font-black ${
                                            penalty === 0 ? 'bg-green-600/20 text-green-300' : penalty < 10 ? 'bg-yellow-500/20 text-yellow-300' : 'bg-red-600/20 text-red-300'
                                        }`}>
                                            {penalty > 0 ? `+${penalty}` : '0'}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        ) : (
            <div className="px-4 py-8 text-center text-gray-400">Niet ingevuld</div>
        )}
    </div>
);
