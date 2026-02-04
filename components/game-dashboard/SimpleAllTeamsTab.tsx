'use client';

import { useMemo, useState } from 'react';
import { Selector } from '@/components/Selector';

interface Rider {
  riderId: string;
  riderNameId: string;
  riderName: string;
  riderTeam: string;
  pointsScored: number;
}

interface Team {
  participantId: string;
  playername: string;
  userId: string;
  ranking: number;
  riders: Rider[];
}

interface SimpleAllTeamsTabProps {
  teams: Team[];
  currentUserId?: string;
  loading: boolean;
  error: string | null;
}

interface PlayerSelectorProps {
  teams: Team[];
  selectedUserId: string | null;
  onSelect: (userId: string | null) => void;
  excludeUserId?: string;
  placeholder: string;
}

function PlayerSelector({
  teams,
  selectedUserId,
  onSelect,
  excludeUserId,
  placeholder,
}: PlayerSelectorProps) {
  const filteredTeams = teams.filter((team) => !excludeUserId || team.userId !== excludeUserId);
  const selectedTeam = selectedUserId ? teams.find((team) => team.userId === selectedUserId) : null;

  return (
    <Selector<Team>
      items={filteredTeams}
      selectedItems={selectedTeam ? [selectedTeam] : []}
      setSelectedItems={(items) => onSelect(items.length > 0 ? items[0].userId : null)}
      multiSelect={false}
      multiSelectShowSelected={false}
      placeholder={placeholder}
      searchFilter={(team, search) => team.playername.toLowerCase().includes(search.toLowerCase())}
      isEqual={(a, b) => a.userId === b.userId}
      renderItem={(team) => (
        <span className="text-sm">
          <span className="text-gray-500 font-medium">#{team.ranking}</span> {team.playername}
        </span>
      )}
      renderSelectedItem={(team) => (
        <span className="text-sm">#{team.ranking} {team.playername}</span>
      )}
      getItemLabel={(team) => `#${team.ranking} - ${team.playername}`}
      sortKey={(team) => String(team.ranking).padStart(4, '0')}
      initialResultsLimit={100}
    />
  );
}

export function SimpleAllTeamsTab({ teams, currentUserId, loading, error }: SimpleAllTeamsTabProps) {
  const [leftUserId, setLeftUserId] = useState<string>(currentUserId || '');
  const [rightUserId, setRightUserId] = useState<string>('');

  const sortedTeams = useMemo(
    () => [...(teams || [])].sort((a, b) => a.ranking - b.ranking || a.playername.localeCompare(b.playername)),
    [teams]
  );

  const leftTeam = sortedTeams.find((team) => team.userId === leftUserId) || null;
  const rightTeam = sortedTeams.find((team) => team.userId === rightUserId) || null;

  const headToHead = useMemo(() => {
    if (!leftTeam || !rightTeam) {
      return { leftUnique: [] as Rider[], rightUnique: [] as Rider[], shared: [] as Rider[] };
    }

    const leftMap = new Map<string, Rider>();
    const rightMap = new Map<string, Rider>();

    leftTeam.riders.forEach((rider) => {
      const key = rider.riderNameId || rider.riderId || rider.riderName;
      leftMap.set(key, rider);
    });

    rightTeam.riders.forEach((rider) => {
      const key = rider.riderNameId || rider.riderId || rider.riderName;
      rightMap.set(key, rider);
    });

    const sharedKeys = new Set<string>();
    leftMap.forEach((_, key) => {
      if (rightMap.has(key)) sharedKeys.add(key);
    });

    const leftUnique = Array.from(leftMap.entries())
      .filter(([key]) => !sharedKeys.has(key))
      .map(([, rider]) => rider)
      .sort((a, b) => b.pointsScored - a.pointsScored);

    const rightUnique = Array.from(rightMap.entries())
      .filter(([key]) => !sharedKeys.has(key))
      .map(([, rider]) => rider)
      .sort((a, b) => b.pointsScored - a.pointsScored);

    const shared = Array.from(sharedKeys)
      .map((key) => leftMap.get(key) || rightMap.get(key))
      .filter((rider): rider is Rider => Boolean(rider))
      .sort((a, b) => b.pointsScored - a.pointsScored);

    return { leftUnique, rightUnique, shared };
  }, [leftTeam, rightTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-lg text-gray-600">Laden...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Alle teams</h3>
        <div className="space-y-4">
          {sortedTeams.map((team) => (
            <div key={team.participantId} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="font-semibold text-gray-900">
                #{team.ranking} {team.playername}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {team.riders.map((rider) => (
                  <span
                    key={`${team.participantId}-${rider.riderId || rider.riderNameId}`}
                    className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-sm"
                  >
                    {rider.riderName}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Head-to-head</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <PlayerSelector
            teams={sortedTeams}
            selectedUserId={leftUserId || null}
            onSelect={(userId) => setLeftUserId(userId || '')}
            placeholder="Kies speler links..."
          />
          <PlayerSelector
            teams={sortedTeams}
            selectedUserId={rightUserId || null}
            onSelect={(userId) => setRightUserId(userId || '')}
            excludeUserId={leftUserId}
            placeholder="Kies speler rechts..."
          />
        </div>

        {!leftTeam || !rightTeam ? (
          <div className="text-sm text-gray-500">Kies twee spelers om teams te vergelijken.</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-blue-200 p-4">
                <div className="font-semibold text-blue-800 mb-3">{leftTeam.playername}</div>
                <div className="rounded-md border border-green-200 bg-green-50 p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wide text-green-700 font-semibold">Gedeeld</div>
                    <div className="text-xs text-green-700 font-medium">{headToHead.shared.length}</div>
                  </div>
                  <ul className="space-y-1">
                    {headToHead.shared.map((rider) => (
                      <li key={`left-shared-${rider.riderId || rider.riderNameId}`} className="text-sm text-gray-700">
                        {rider.riderName}
                      </li>
                    ))}
                    {headToHead.shared.length === 0 && (
                      <li className="text-sm text-gray-400">Geen gedeelde renners</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wide text-orange-700 font-semibold">Niet gedeeld</div>
                    <div className="text-xs text-orange-700 font-medium">{headToHead.leftUnique.length}</div>
                  </div>
                  <ul className="space-y-1">
                    {headToHead.leftUnique.map((rider) => (
                      <li key={`left-unique-${rider.riderId || rider.riderNameId}`} className="text-sm text-gray-700">
                        {rider.riderName}
                      </li>
                    ))}
                    {headToHead.leftUnique.length === 0 && (
                      <li className="text-sm text-gray-400">Geen unieke renners</li>
                    )}
                  </ul>
                </div>
              </div>
              <div className="bg-white rounded-lg border border-purple-200 p-4">
                <div className="font-semibold text-purple-800 mb-3">{rightTeam.playername}</div>
                <div className="rounded-md border border-green-200 bg-green-50 p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wide text-green-700 font-semibold">Gedeeld</div>
                    <div className="text-xs text-green-700 font-medium">{headToHead.shared.length}</div>
                  </div>
                  <ul className="space-y-1">
                    {headToHead.shared.map((rider) => (
                      <li key={`right-shared-${rider.riderId || rider.riderNameId}`} className="text-sm text-gray-700">
                        {rider.riderName}
                      </li>
                    ))}
                    {headToHead.shared.length === 0 && (
                      <li className="text-sm text-gray-400">Geen gedeelde renners</li>
                    )}
                  </ul>
                </div>
                <div className="rounded-md border border-orange-200 bg-orange-50 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs uppercase tracking-wide text-orange-700 font-semibold">Niet gedeeld</div>
                    <div className="text-xs text-orange-700 font-medium">{headToHead.rightUnique.length}</div>
                  </div>
                  <ul className="space-y-1">
                    {headToHead.rightUnique.map((rider) => (
                      <li key={`right-unique-${rider.riderId || rider.riderNameId}`} className="text-sm text-gray-700">
                        {rider.riderName}
                      </li>
                    ))}
                    {headToHead.rightUnique.length === 0 && (
                      <li className="text-sm text-gray-400">Geen unieke renners</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

          </div>
        )}
      </section>
    </div>
  );
}
