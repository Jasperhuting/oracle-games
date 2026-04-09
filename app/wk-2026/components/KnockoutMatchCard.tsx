'use client';

import type { ReactNode } from 'react';
import { Flag } from '@/components/Flag';
import countriesList from '@/lib/country.json';
import type { HeadToHeadMatch, MatchResult, TeamHistoryResponse } from '@/lib/wk-2026/team-history-types';

export interface KnockoutMatchCardProps {
  matchId: string;
  matchNumber: number;
  date: string;
  stadium: string;
  location: string;
  team1Id: string | null | undefined;
  team2Id: string | null | undefined;
  team1Source: string;
  team2Source: string;
  team1Score: number | null | undefined;
  team2Score: number | null | undefined;
  winnerId: string | null | undefined;
  getTeamName: (teamId: string | null | undefined) => string;
  getTeamFlagCode?: (teamId: string | null | undefined) => string;
  renderTeamDisplay: (teamId: string | null | undefined, source: string) => ReactNode;
  onScoreChange: (matchId: string, team: 'team1' | 'team2', score: string) => void;
  onWinnerSelect?: (matchId: string, winnerId: string) => void;
  history?: TeamHistoryResponse | null;
  historyLoading?: boolean;
}

function getFlagCode(name: string, fallbackId: string): string {
  const entry = (countriesList as { name: string; code: string }[]).find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  return entry?.code ?? fallbackId;
}

function FormDot({ match }: { match: MatchResult }) {
  const color = match.result === 'W' ? 'bg-green-500' : match.result === 'D' ? 'bg-orange-400' : 'bg-red-500';
  const label = match.result === 'W' ? 'W' : match.result === 'D' ? 'G' : 'V';
  const tooltip = `${match.teamScore}-${match.opponentScore} vs ${match.opponent} (${match.competition}, ${match.date})`;

  return (
    <div className="relative group">
      <div
        className={`w-5 h-5 rounded-full ${color} flex items-center justify-center text-white text-[9px] font-bold cursor-default`}
        title={tooltip}
      >
        {label}
      </div>
      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block z-50">
        <div className="bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <span className="font-semibold">{match.teamScore}-{match.opponentScore}</span>{' '}vs {match.opponent}
          <br />
          <span className="text-gray-400 text-[10px]">{match.competition} · {match.date}</span>
        </div>
        <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
      </div>
    </div>
  );
}

function H2HRow({ match, team1Name, team2Name }: { match: HeadToHeadMatch; team1Name: string; team2Name: string }) {
  const result =
    match.team1Score > match.team2Score ? `${team1Name} won` :
    match.team1Score < match.team2Score ? `${team2Name} won` : 'Gelijkspel';

  return (
    <div className="flex items-center justify-between py-0.5 text-xs text-gray-600">
      <span className="w-20 shrink-0 text-gray-400">{match.date.slice(0, 7)}</span>
      <span className={`font-semibold ${match.team1Score > match.team2Score ? 'text-[#ff9900]' : match.team1Score < match.team2Score ? 'text-red-500' : 'text-gray-500'}`}>
        {match.team1Score} – {match.team2Score}
      </span>
      <span className="w-20 shrink-0 truncate text-right text-gray-400">{result}</span>
    </div>
  );
}

export function KnockoutMatchCard({
  matchId, matchNumber, date, stadium, location,
  team1Id, team2Id, team1Source, team2Source,
  team1Score, team2Score, winnerId,
  getTeamName, getTeamFlagCode, renderTeamDisplay, onScoreChange, onWinnerSelect,
  history, historyLoading,
}: KnockoutMatchCardProps) {
  const isTied =
    team1Score !== null && team1Score !== undefined &&
    team2Score !== null && team2Score !== undefined &&
    team1Score === team2Score;

  const team1Name = team1Id ? getTeamName(team1Id) : null;
  const team2Name = team2Id ? getTeamName(team2Id) : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      {/* Match header */}
      <div className="flex items-center justify-between mb-3 text-[10px] text-gray-400">
        <span className="font-medium">Match {matchNumber} · {date}</span>
        <span className="truncate max-w-[160px] text-right">{stadium}, {location}</span>
      </div>

      {/* Teams and score inputs */}
      <div className="grid grid-cols-7 gap-2 items-center">
        <div className="col-span-3">
          <div className="text-[10px] text-gray-400 mb-1 truncate">{team1Source}</div>
          <div className="flex items-start gap-1">{renderTeamDisplay(team1Id, team1Source)}</div>
          {team1Name && team1Name !== '?' && (
            <div className="text-xs font-medium text-gray-700 mt-1 truncate">{team1Name}</div>
          )}
        </div>

        <div className="col-span-1 flex items-center justify-center gap-1">
          <input
            type="number"
            min="0"
            value={team1Score ?? ''}
            onChange={(e) => onScoreChange(matchId, 'team1', e.target.value)}
            className="w-10 px-1 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm focus:border-[#ff9900] focus:outline-none focus:ring-1 focus:ring-[#ff9900]"
            placeholder="0"
          />
          <span className="text-gray-300 text-xs">-</span>
          <input
            type="number"
            min="0"
            value={team2Score ?? ''}
            onChange={(e) => onScoreChange(matchId, 'team2', e.target.value)}
            className="w-10 px-1 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm focus:border-[#ff9900] focus:outline-none focus:ring-1 focus:ring-[#ff9900]"
            placeholder="0"
          />
        </div>

        <div className="col-span-3 text-right">
          <div className="text-[10px] text-gray-400 mb-1 truncate text-right">{team2Source}</div>
          <div className="flex items-start justify-end gap-1">{renderTeamDisplay(team2Id, team2Source)}</div>
          {team2Name && team2Name !== '?' && (
            <div className="text-xs font-medium text-gray-700 mt-1 truncate">{team2Name}</div>
          )}
        </div>
      </div>

      {/* H2H and form (optional) */}
      {historyLoading && (
        <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 animate-pulse">
          Historische resultaten laden...
        </div>
      )}

      {!historyLoading && history && team1Name && team2Name && (
        <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
          {history.team1Form.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Laatste 5: {team1Name}
              </div>
              <div className="flex gap-1">
                {history.team1Form.map((m, i) => <FormDot key={i} match={m} />)}
              </div>
            </div>
          )}
          {history.team2Form.length > 0 && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Laatste 5: {team2Name}
              </div>
              <div className="flex gap-1">
                {history.team2Form.map((m, i) => <FormDot key={i} match={m} />)}
              </div>
            </div>
          )}
          {history.headToHead.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                Onderling ({history.headToHead.length}x)
              </div>
              {[...history.headToHead].reverse().map((m, i) => (
                <H2HRow key={i} match={m} team1Name={team1Name} team2Name={team2Name} />
              ))}
            </div>
          )}
          {history.headToHead.length === 0 && (
            <div className="text-xs text-gray-400">Nog nooit tegen elkaar gespeeld</div>
          )}
        </div>
      )}

      {/* Penalties selector */}
      {isTied && team1Id && team2Id && onWinnerSelect && (
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-semibold text-amber-700 mb-2">Wie wint na strafschoppen?</p>
          <select
            value={winnerId || ''}
            onChange={(e) => onWinnerSelect(matchId, e.target.value)}
            className="w-full px-3 py-2 border border-amber-200 rounded-lg bg-white text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-amber-400"
          >
            <option value="">Kies winnaar...</option>
            <option value={team1Id}>{team1Name}</option>
            <option value={team2Id}>{team2Name}</option>
          </select>
        </div>
      )}

      {/* Winner display */}
      {winnerId && !isTied && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff9900] font-semibold">
          <span>Winnaar:</span>
          <Flag countryCode={getTeamFlagCode ? getTeamFlagCode(winnerId) : getFlagCode(getTeamName(winnerId), winnerId)} width={16} />
          <span>{getTeamName(winnerId)}</span>
        </div>
      )}
      {winnerId && isTied && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-[#ff9900] font-semibold">
          <span>Na strafschoppen:</span>
          <Flag countryCode={getTeamFlagCode ? getTeamFlagCode(winnerId) : getFlagCode(getTeamName(winnerId), winnerId)} width={16} />
          <span>{getTeamName(winnerId)}</span>
        </div>
      )}
    </div>
  );
}
