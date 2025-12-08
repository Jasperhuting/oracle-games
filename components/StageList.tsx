'use client';

import { useEffect, useState } from 'react';

type StageMeta = {
  stage: number;
  url: string;
  lastModified: string | null;
};

export function StageList({ race, year, maxStages = 21 }: { race: string; year: number; maxStages?: number }) {
  const [stages, setStages] = useState<StageMeta[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openStages, setOpenStages] = useState<Record<number, boolean>>({});
  const [stageData, setStageData] = useState<Record<number, { loading: boolean; error?: string | null; data?: any }>>({});  // eslint-disable-line @typescript-eslint/no-explicit-any

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ race, year: String(year), maxStages: String(maxStages) });
        const res = await fetch(`/api/stage-metadata?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setStages((data.stages || []).map((s: StageMeta) => ({
            ...s,
            lastModified: s.lastModified ? new Date(s.lastModified).toLocaleString() : null
          })));
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load stages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [race, year, maxStages]);

  if (loading) return <div className="text-xs text-gray-500">Checking stages…</div>;
  if (error) return <div className="text-xs text-red-600">{error}</div>;
  if (!stages || stages.length === 0) return <div className="text-xs text-gray-500">No stage results found yet.</div>;

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Stage results</h3>
      <div className="space-y-2">
        {stages.map((s) => (
          <div key={s.stage} className="rounded border border-black/10 dark:border-white/10">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/10"
              onClick={async () => {
                setOpenStages(prev => ({ ...prev, [s.stage]: !prev[s.stage] }));
                const alreadyLoaded = stageData[s.stage]?.data || stageData[s.stage]?.loading;
                if (!alreadyLoaded) {
                  setStageData(prev => ({ ...prev, [s.stage]: { loading: true, error: null } }));
                  try {
                    const params = new URLSearchParams({ race, year: String(year), stage: String(s.stage) });
                    const res = await fetch(`/api/stage?${params.toString()}`);
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const json = await res.json();
                    setStageData(prev => ({ ...prev, [s.stage]: { loading: false, data: json.data } }));
                  } catch (e: unknown) {
                    setStageData(prev => ({ ...prev, [s.stage]: { loading: false, error: e instanceof Error ? e.message : 'Failed to load stage' } }));
                  }
                }
              }}
              title={s.lastModified ? `Last updated: ${s.lastModified}` : undefined}
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-black/10 dark:bg-white/10">{openStages[s.stage] ? '−' : '+'}</span>
                <span>Stage {s.stage}</span>
              </span>
              <span className="opacity-60">{s.lastModified || ''}</span>
            </button>

            {openStages[s.stage] && (
              <div className="px-3 pb-3">
                {stageData[s.stage]?.loading && (
                  <div className="text-xs text-gray-500">Loading…</div>
                )}
                {stageData[s.stage]?.error && (
                  <div className="text-xs text-red-600">{stageData[s.stage]?.error}</div>
                )}
                {stageData[s.stage]?.data && (
                  <StageResultView data={stageData[s.stage]?.data} />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageResultView({ data }: { data: any }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  // Normalize possible structures
  const results = Array.isArray(data?.results)
    ? data.results
    : Array.isArray(data)
    ? data
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray((data as any)?.stageResults) // eslint-disable-line @typescript-eslint/no-explicit-any
    ? (data as any).stageResults // eslint-disable-line @typescript-eslint/no-explicit-any
    : Array.isArray((data as any)?.data?.stageResults) // eslint-disable-line @typescript-eslint/no-explicit-any
    ? (data as any).data.stageResults // eslint-disable-line @typescript-eslint/no-explicit-any
    : null;

  if (!results || results.length === 0) {
    return (
      <pre className="mt-2 overflow-auto rounded bg-black/5 p-2 text-[11px] leading-tight dark:bg-white/10">{JSON.stringify(data, null, 2)}</pre>
    );
  }

  // Create normalized view rows for better display (non-destructive)
  const normalizedResults = (results as Array<Record<string, unknown>>).map((r) => {
    const firstName = (r.firstName as string) || '';
    const lastName = (r.lastName as string) || '';
    const rider = (r.rider as string) || `${firstName} ${lastName}`.trim();
    const bib = (r.bib as string) || (r.number as string) || (r.startNumber as string) || undefined;
    const time = (r.time as string) || (r.resultTime as string) || (r.qualificationTime as string) || undefined;
    const gap = (r.gap as string) || (r.timeDifference as string) || undefined;
    const position = (r.position as number | string) || (r.pos as number | string) || (r.place as number | string) || undefined;
    return { ...r, rider, bib, time, gap, position } as Record<string, unknown>;
  });

  // Determine columns by preference order, falling back to detected keys
  const preferred: string[] = [
    'rank','position','place','pos',
    'rider','firstName','lastName',
    'team','country',
    'time','gap','timeDifference','qualificationTime',
    'uciPoints','points',
    'bib','startNumber','number',
    'gc','shortName'
  ];
  const detected: string[] = Array.from<string>(
    normalizedResults
      .slice(0, 10)
      .reduce((set: Set<string>, row: Record<string, unknown>) => {
        Object.keys(row || {}).forEach((k: string) => set.add(k));
        return set;
      }, new Set<string>())
  );
  const columns: string[] = preferred
    .filter((c: string) => detected.includes(c))
    .concat(detected.filter((k: string) => !preferred.includes(k)));

  return (
    <div className="overflow-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-black/10 dark:border-white/10">
            {columns.map(col => (
              <th key={col} className="px-2 py-1 text-left font-medium capitalize whitespace-nowrap">{col.replace(/_/g, ' ')}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {normalizedResults.map((row: Record<string, unknown>, idx: number) => (
            <tr key={idx} className="border-b border-black/5 dark:border-white/5">
              {columns.map(col => (
                <td key={col} className="px-2 py-1 whitespace-nowrap">
                  {formatCell((row as Record<string, unknown>)[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
