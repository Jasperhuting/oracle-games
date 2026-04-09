'use client';

import { useState } from 'react';
import { Flag } from '@/components/Flag';
import countriesList from '@/lib/country.json';
import {
  createTeamHistoryPairKey,
  orientTeamHistory,
  type HeadToHeadMatch,
  type MatchResult,
  type StoredTeamHistoryMap,
  type TeamHistoryResponse,
} from '@/lib/wk-2026/team-history-types';

export interface PoulePredictorTeam {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface PoulePredictorMatch {
  id: string;
  team1Id: string;
  team2Id: string;
  team1Score: number | null;
  team2Score: number | null;
}

interface TeamStats {
  teamId: string;
  team: PoulePredictorTeam;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface PoulePredictorProps {
  pouleLabel: string;
  teams: PoulePredictorTeam[];
  rankings: (PoulePredictorTeam | null)[];
  matches: PoulePredictorMatch[];
  onRankingsChange: (rankings: (PoulePredictorTeam | null)[]) => void;
  onScoreChange: (matchId: string, team: 'team1' | 'team2', score: string) => void;
  teamHistory?: StoredTeamHistoryMap;
  historyLoading?: boolean;
}

function getFlagCode(name: string, fallbackId: string): string {
  const entry = (countriesList as { name: string; code: string }[]).find(
    (c) => c.name.toLowerCase() === name.toLowerCase()
  );
  return entry?.code ?? fallbackId;
}

function calculateStandings(teams: PoulePredictorTeam[], matches: PoulePredictorMatch[]): TeamStats[] {
  const map: Record<string, TeamStats> = {};
  teams.forEach((t) => {
    map[t.id] = {
      teamId: t.id, team: t, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0,
    };
  });

  matches.forEach((m) => {
    if (m.team1Score === null || m.team2Score === null) return;
    const a = map[m.team1Id];
    const b = map[m.team2Id];
    if (!a || !b) return;

    a.played++; b.played++;
    a.goalsFor += m.team1Score; a.goalsAgainst += m.team2Score;
    b.goalsFor += m.team2Score; b.goalsAgainst += m.team1Score;

    if (m.team1Score > m.team2Score) { a.won++; a.points += 3; b.lost++; }
    else if (m.team2Score > m.team1Score) { b.won++; b.points += 3; a.lost++; }
    else { a.drawn++; b.drawn++; a.points++; b.points++; }

    a.goalDifference = a.goalsFor - a.goalsAgainst;
    b.goalDifference = b.goalsFor - b.goalsAgainst;
  });

  return Object.values(map).sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.goalDifference !== x.goalDifference) return y.goalDifference - x.goalDifference;
    return y.goalsFor - x.goalsFor;
  });
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

function H2HRow({ match, team1Name, team2Name }: { match: HeadToHeadMatch; team1Name: string; team2Name: string }) {
  const result =
    match.team1Score > match.team2Score ? `${team1Name} won` :
    match.team1Score < match.team2Score ? `${team2Name} won` : 'Gelijkspel';

  return (
    <div className="flex items-center justify-between text-xs text-gray-600 py-0.5">
      <span className="text-gray-400 w-20 shrink-0">{match.date.slice(0, 7)}</span>
      <span className={`font-semibold ${match.team1Score > match.team2Score ? 'text-[#ff9900]' : match.team1Score < match.team2Score ? 'text-red-500' : 'text-gray-500'}`}>
        {match.team1Score} – {match.team2Score}
      </span>
      <span className="text-gray-400 w-24 text-right shrink-0 truncate">{result}</span>
    </div>
  );
}

export function PoulePredictor({
  pouleLabel, teams, rankings, matches, onRankingsChange, onScoreChange,
  teamHistory, historyLoading,
}: PoulePredictorProps) {
  const [draggedTeam, setDraggedTeam] = useState<PoulePredictorTeam | null>(null);
  const [draggedFromPos, setDraggedFromPos] = useState<number | null>(null);

  const handleDrop = (toPos: number) => {
    if (!draggedTeam) return;
    const updated = [...rankings];
    const teamAtDest = updated[toPos];

    if (teamAtDest && teamAtDest.id !== draggedTeam.id && draggedFromPos !== null) {
      updated[draggedFromPos] = teamAtDest;
      updated[toPos] = draggedTeam;
    } else {
      if (draggedFromPos !== null) updated[draggedFromPos] = null;
      updated[toPos] = draggedTeam;
    }

    onRankingsChange(updated);
    setDraggedTeam(null);
    setDraggedFromPos(null);
  };

  const standings = calculateStandings(teams, matches);

  const getMatchHistory = (t1: PoulePredictorTeam, t2: PoulePredictorTeam): TeamHistoryResponse | null => {
    if (!teamHistory) return null;
    const pairKey = createTeamHistoryPairKey(t1.name, t2.name);
    const stored = teamHistory[pairKey];
    if (!stored) return null;
    return orientTeamHistory(stored.data, t1.name, t2.name);
  };

  return (
    <div className="space-y-6">
      {/* Drag-to-rank predicted standings */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Jouw voorspelde eindstand – Poule {pouleLabel}
        </h3>
        <p className="text-xs text-gray-500 mb-3">Sleep de volgorde van de teams</p>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden max-w-xs">
          {[0, 1, 2, 3].map((pos) => {
            const team = rankings[pos];
            return team ? (
              <div
                key={pos}
                draggable
                onDragStart={() => { setDraggedTeam(team); setDraggedFromPos(pos); }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(pos)}
                className={`flex items-center gap-3 px-4 py-3 cursor-move select-none border-b border-gray-100 last:border-0 transition-colors ${pos < 2 ? 'bg-orange-50/50 hover:bg-orange-50' : 'bg-white hover:bg-gray-50'}`}
              >
                <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full text-xs font-bold ${pos < 2 ? 'bg-orange-100 text-[#ff9900]' : 'bg-gray-100 text-gray-500'}`}>
                  {pos + 1}
                </span>
                <Flag countryCode={getFlagCode(team.name, team.id)} width={24} />
                <span className="text-sm font-medium text-gray-900 flex-1">{team.name}</span>
                {pos < 2 && <span className="text-[10px] font-semibold text-[#ff9900]">Door</span>}
              </div>
            ) : (
              <div
                key={pos}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(pos)}
                className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 bg-gray-50/60 min-h-[52px] hover:bg-orange-50/20 transition-colors"
              >
                <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 text-xs font-bold">
                  {pos + 1}
                </span>
                <span className="text-xs text-gray-400">Sleep team hierheen</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Match score inputs */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Uitslagen – Poule {pouleLabel}
        </h3>
        <p className="text-xs text-gray-500 mb-3">Voorspel de scores per wedstrijd</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {matches.map((match, i) => {
            const t1 = teams.find((t) => t.id === match.team1Id);
            const t2 = teams.find((t) => t.id === match.team2Id);
            if (!t1 || !t2) return null;

            const history = getMatchHistory(t1, t2);
            const t1Form = history?.team1Form ?? [];
            const t2Form = history?.team2Form ?? [];
            const h2h = [...(history?.headToHead ?? [])].reverse();

            return (
              <div key={match.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-[10px] text-gray-400 mb-3 font-medium uppercase tracking-wide">Wedstrijd {i + 1}</div>

                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Flag countryCode={getFlagCode(t1.name, t1.id)} width={22} />
                    <span className="text-sm font-medium text-gray-900 truncate">{t1.name}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={match.team1Score ?? ''}
                    onChange={(e) => onScoreChange(match.id, 'team1', e.target.value)}
                    className="w-12 px-2 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm focus:border-[#ff9900] focus:outline-none focus:ring-1 focus:ring-[#ff9900]"
                    placeholder="0"
                  />
                </div>

                {t1Form.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 pl-7">
                    {t1Form.map((m, fi) => <FormDot key={fi} match={m} />)}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Flag countryCode={getFlagCode(t2.name, t2.id)} width={22} />
                    <span className="text-sm font-medium text-gray-900 truncate">{t2.name}</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={match.team2Score ?? ''}
                    onChange={(e) => onScoreChange(match.id, 'team2', e.target.value)}
                    className="w-12 px-2 py-1.5 border border-gray-200 rounded-lg text-center font-bold text-sm focus:border-[#ff9900] focus:outline-none focus:ring-1 focus:ring-[#ff9900]"
                    placeholder="0"
                  />
                </div>

                {t2Form.length > 0 && (
                  <div className="flex items-center gap-1 mb-2 pl-7">
                    {t2Form.map((m, fi) => <FormDot key={fi} match={m} />)}
                  </div>
                )}

                {historyLoading && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400 animate-pulse">
                    Historische data laden...
                  </div>
                )}

                {!historyLoading && h2h.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                      Onderling ({h2h.length}x)
                    </div>
                    {h2h.map((m, hi) => (
                      <H2HRow key={hi} match={m} team1Name={t1.name} team2Name={t2.name} />
                    ))}
                  </div>
                )}

                {!historyLoading && history && h2h.length === 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                    Nog nooit tegen elkaar gespeeld
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Auto-calculated standings table */}
      <div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">
          Berekende stand – Poule {pouleLabel}
        </h3>
        <p className="text-xs text-gray-500 mb-3">Automatisch berekend op basis van jouw uitslagen</p>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Team</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">P</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">W</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">G</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">V</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-semibold text-gray-500 uppercase">+/-</th>
                <th className="px-2 py-2.5 text-center text-[10px] font-bold text-gray-700 uppercase">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {standings.map((s, i) => (
                <tr key={s.teamId} className={i < 2 ? 'bg-orange-50/30' : 'bg-white'}>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-bold ${i < 2 ? 'bg-orange-100 text-[#ff9900]' : 'bg-gray-100 text-gray-500'}`}>
                      {i + 1}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Flag countryCode={getFlagCode(s.team.name, s.teamId)} width={20} />
                      <span className="text-xs font-medium text-gray-900">{s.team.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2.5 text-center text-xs text-gray-600">{s.played}</td>
                  <td className="px-2 py-2.5 text-center text-xs text-gray-600">{s.won}</td>
                  <td className="px-2 py-2.5 text-center text-xs text-gray-600">{s.drawn}</td>
                  <td className="px-2 py-2.5 text-center text-xs text-gray-600">{s.lost}</td>
                  <td className="px-2 py-2.5 text-center text-xs font-medium text-gray-600">
                    {s.goalDifference > 0 ? '+' : ''}{s.goalDifference}
                  </td>
                  <td className="px-2 py-2.5 text-center text-sm font-bold text-gray-900">{s.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2.5 text-[10px] text-gray-400 border-t border-gray-50 flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 bg-orange-50 border border-orange-200 rounded-sm" />
            Top 2 gaat door naar de knockout-fase
          </p>
        </div>
      </div>
    </div>
  );
}
