'use client';

import { useEffect, useState } from 'react';
import { Flag } from '@/components/Flag';
import { getCountryNameNL } from '@/lib/country-nl';
import type { FixtureEntry } from '@/app/api/wk-2026/all-fixtures/route';

const DATE_NL: Record<string, string> = {
  Monday: 'maandag', Tuesday: 'dinsdag', Wednesday: 'woensdag',
  Thursday: 'donderdag', Friday: 'vrijdag', Saturday: 'zaterdag', Sunday: 'zondag',
};
const MONTH_NL: Record<string, string> = {
  January: 'januari', February: 'februari', March: 'maart', April: 'april',
  May: 'mei', June: 'juni', July: 'juli', August: 'augustus',
  September: 'september', October: 'oktober', November: 'november', December: 'december',
};

function formatDateNL(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const parts = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).split(' ');
  const [weekday, day, month, year] = parts;
  return `${DATE_NL[weekday] ?? weekday} ${day} ${MONTH_NL[month] ?? month} ${year}`;
}

function groupByDate(fixtures: FixtureEntry[]): Map<string, FixtureEntry[]> {
  const map = new Map<string, FixtureEntry[]>();
  for (const fixture of fixtures) {
    const list = map.get(fixture.date) ?? [];
    list.push(fixture);
    map.set(fixture.date, list);
  }
  return map;
}

function TeamDisplay({ team, align }: { team: FixtureEntry['team1']; align: 'left' | 'right' }) {
  if (!team) return <div className="flex-1" />;

  const isTbd = team.code === 'xx';
  const displayName = isTbd
    ? team.displaySource ?? team.name
    : getCountryNameNL(team.code, team.name);

  return (
    <div className={`flex items-center gap-2 flex-1 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
      {!isTbd && <Flag countryCode={team.code} width={24} className="flex-shrink-0" />}
      <span className={`text-sm font-semibold ${isTbd ? 'text-gray-400 text-xs' : 'text-gray-800'}`}>
        {displayName}
      </span>
    </div>
  );
}

function MatchCard({ fixture }: { fixture: FixtureEntry }) {
  const hasScore = fixture.team1Score !== null && fixture.team2Score !== null;
  const isKnockout = fixture.type === 'knockout';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Round / venue label */}
      <div className="px-4 py-1.5 bg-[#fff7eb] border-b border-orange-100 flex items-center justify-between">
        <span className="text-[10px] text-[#7a3c00] font-semibold uppercase tracking-wider">
          {fixture.round}
        </span>
        <span className="text-[10px] text-gray-400">
          {fixture.stadium} · {fixture.city}
        </span>
      </div>

      {/* Match row */}
      <div className="flex items-center px-4 py-3 gap-3">
        <TeamDisplay team={fixture.team1} align="left" />

        {/* Score or time */}
        <div className="flex flex-col items-center min-w-[72px]">
          {hasScore ? (
            <div className="flex items-center gap-1">
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{fixture.team1Score}</span>
              <span className="text-gray-300 text-xl">-</span>
              <span className="text-2xl font-bold text-gray-900 tabular-nums">{fixture.team2Score}</span>
            </div>
          ) : isKnockout ? (
            <span className="text-xs font-medium text-gray-400">nog te spelen</span>
          ) : (
            <span className="text-lg font-bold text-[#ff9900]">{fixture.time}</span>
          )}
          {!hasScore && !isKnockout && (
            <span className="text-[10px] text-gray-400 mt-0.5">CEST</span>
          )}
        </div>

        <TeamDisplay team={fixture.team2} align="right" />
      </div>
    </div>
  );
}

export default function WedstrijdenPage() {
  const [fixtures, setFixtures] = useState<FixtureEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'group' | 'knockout'>('all');

  useEffect(() => {
    fetch('/api/wk-2026/all-fixtures')
      .then(r => r.json())
      .then(data => {
        setFixtures(data.fixtures ?? []);
        setLoading(false);
      })
      .catch(() => {
        setError('Kon wedstrijden niet laden');
        setLoading(false);
      });
  }, []);

  const filtered = fixtures.filter(f =>
    filter === 'all' ? true : f.type === filter
  );

  const byDate = groupByDate(filtered);

  return (
    <div className="p-6 mt-9 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-2 text-gray-900">Wedstrijdprogramma WK 2026</h1>
      <p className="text-sm text-gray-500 mb-6">Alle tijden in CEST (Nederlandse tijd)</p>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6">
        {(['all', 'group', 'knockout'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === f
                ? 'bg-[#ff9900] text-white'
                : 'bg-white text-[#7a3c00] border border-gray-200 hover:bg-[#fff7eb]'
            }`}
          >
            {f === 'all' ? 'Alle wedstrijden' : f === 'group' ? 'Groepsfase' : 'Knock-out'}
          </button>
        ))}
      </div>

      {loading && (
        <div className="text-center text-gray-400 py-16">Laden...</div>
      )}

      {error && (
        <div className="text-center text-red-500 py-16">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-8">
          {Array.from(byDate.entries()).map(([date, dayFixtures]) => (
            <div key={date}>
              {/* Date header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs font-bold text-[#ff9900] uppercase tracking-widest whitespace-nowrap">
                  {formatDateNL(date)}
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              <div className="space-y-2">
                {dayFixtures.map(fixture => (
                  <MatchCard key={`${fixture.type}-${fixture.matchNumber}`} fixture={fixture} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
