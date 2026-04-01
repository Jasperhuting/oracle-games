'use client';

import type { MatchResult, HeadToHeadMatch, TeamHistoryResponse } from '@/app/api/wk-2026/team-history/route';

export type { MatchResult, HeadToHeadMatch, TeamHistoryResponse };

export function pairKey(a: string, b: string): string {
    return [a, b].sort().join('__');
}

interface FormDotProps {
    match: MatchResult;
}

export function FormDot({ match }: FormDotProps) {
    const color =
        match.result === 'W'
            ? 'bg-green-500'
            : match.result === 'D'
            ? 'bg-orange-400'
            : 'bg-red-500';

    const label = match.result === 'W' ? 'W' : match.result === 'D' ? 'G' : 'V';

    return (
        <div className="relative group">
            <div
                className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold cursor-default select-none`}
            >
                {label}
            </div>
            <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50">
                <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                    <span className="font-semibold">{match.teamScore}-{match.opponentScore}</span>{' '}
                    vs {match.opponent}
                    <br />
                    <span className="text-gray-400 text-[10px]">{match.competition} · {match.date}</span>
                </div>
                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
            </div>
        </div>
    );
}

interface FormDotsRowProps {
    form: MatchResult[];
}

export function FormDotsRow({ form }: FormDotsRowProps) {
    if (!form || form.length === 0) return null;
    return (
        <div className="flex items-center gap-1">
            {form.map((m, i) => <FormDot key={i} match={m} />)}
        </div>
    );
}

interface H2HSectionProps {
    headToHead: HeadToHeadMatch[];
    team1Name: string;
    team2Name: string;
}

export function H2HSection({ headToHead, team1Name, team2Name }: H2HSectionProps) {
    if (!headToHead || headToHead.length === 0) {
        return (
            <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                Nog nooit tegen elkaar gespeeld
            </div>
        );
    }

    return (
        <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Onderling ({headToHead.length}x)
            </div>
            {headToHead.map((m, i) => {
                const winner =
                    m.team1Score > m.team2Score
                        ? team1Name
                        : m.team1Score < m.team2Score
                        ? team2Name
                        : 'Gelijkspel';
                const scoreColor =
                    m.team1Score > m.team2Score
                        ? 'text-green-600'
                        : m.team1Score < m.team2Score
                        ? 'text-red-500'
                        : 'text-gray-500';

                return (
                    <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-0.5">
                        <span className="text-gray-400 w-20 shrink-0">{m.date.slice(0, 7)}</span>
                        <span className={`font-semibold ${scoreColor}`}>{m.team1Score} – {m.team2Score}</span>
                        <span className="text-gray-400 w-20 text-right shrink-0 truncate">{winner}</span>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Resolves form and H2H from the teamHistory map for a given pair.
 * Handles the case where the canonical key has the teams in reversed order.
 */
export function resolveHistory(
    team1Name: string,
    team2Name: string,
    teamHistory: Record<string, TeamHistoryResponse>
): { t1Form: MatchResult[]; t2Form: MatchResult[]; h2h: HeadToHeadMatch[]; loaded: boolean } {
    const key = pairKey(team1Name, team2Name);
    const history = teamHistory[key];

    if (!history) return { t1Form: [], t2Form: [], h2h: [], loaded: false };

    // The canonical key is sorted alphabetically.
    // If team1Name sorts first, history.team1Form corresponds to team1Name.
    const isReversed = [team1Name, team2Name].sort()[0] !== team1Name;

    const t1Form = isReversed ? history.team2Form : history.team1Form;
    const t2Form = isReversed ? history.team1Form : history.team2Form;
    const h2h = isReversed
        ? history.headToHead.map(m => ({ ...m, team1Score: m.team2Score, team2Score: m.team1Score }))
        : history.headToHead;

    return { t1Form, t2Form, h2h, loaded: true };
}
