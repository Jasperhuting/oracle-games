# Platform Hook Contracts Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate copy-pasted useState/useCallback/useEffect boilerplate from HTTP hooks and enforce a shared typed contract across all platform data hooks.

**Architecture:** Create `lib/data-fetching/types.ts` with TypeScript interfaces (`PullQueryResult`, `SubscriptionQueryResult`, `MutationResult`), then a `hooks/useFetchHook.ts` primitive that implements the HTTP fetch skeleton. Migrate the two wk-2026 HTTP hooks to use the primitive. Add return-type annotations to all F1 snapshot hooks. Migrate `useF1Prediction` to use `SubscriptionWithMutation`.

**Tech Stack:** React hooks, TypeScript, Vitest, Firebase Firestore `onSnapshot`, `auth.currentUser.getIdToken()` (placeholder until RFC #15 lands)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/data-fetching/types.ts` | **Create** | TypeScript contracts: `PullQueryResult<T>`, `SubscriptionQueryResult<T>`, `MutationResult<TArgs, TReturn>`, `SubscriptionWithMutation` |
| `hooks/useFetchHook.ts` | **Create** | HTTP fetch primitive: `useState` triple + `useCallback` + `useEffect` + `enabled` guard |
| `tests/unit/useFetchHook.test.ts` | **Create** | Unit tests for `useFetchHook` behaviour |
| `app/wk-2026/hooks.ts` | **Modify** | Migrate both hooks to `useFetchHook`; add `PullQueryResult` return types |
| `app/f1/hooks/useF1Data.ts` | **Modify** | Add `SubscriptionQueryResult<T>` return type annotations only |
| `app/f1/hooks/useF1Standings.ts` | **Modify** | Add `SubscriptionQueryResult<T>` return type annotations only |
| `app/f1/hooks/useF1Predictions.ts` | **Modify** | Add `SubscriptionWithMutation` type to `useF1Prediction`; rename `savePrediction` to `mutate` with a backward-compat alias |

---

## Task 1: Type contracts

**Files:**
- Create: `lib/data-fetching/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// lib/data-fetching/types.ts

/**
 * Returned by HTTP-based hooks. Has `refresh` because the caller can
 * explicitly re-trigger a fetch. Use when data comes from a fetch() call.
 */
export interface PullQueryResult<TData> {
  data: TData;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Returned by Firestore onSnapshot hooks. No `refresh` — Firestore pushes
 * updates automatically. Use when data comes from onSnapshot().
 */
export interface SubscriptionQueryResult<TData> {
  data: TData;
  loading: boolean;
  error: Error | null;
}

/**
 * Mixed into hooks that also write data (e.g. useF1Prediction).
 * `mutate` is the standard name for the write function.
 */
export interface MutationResult<TArgs, TReturn = void> {
  mutate: (args: TArgs) => Promise<TReturn>;
  saving: boolean;
  saveError: Error | null;
}

/**
 * For hooks that subscribe (Firestore) AND write (API call).
 * Example: useF1Prediction reads live from Firestore, writes via fetch.
 */
export type SubscriptionWithMutation<TData, TArgs, TReturn = void> =
  SubscriptionQueryResult<TData> & MutationResult<TArgs, TReturn>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "data-fetching"
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
git add "lib/data-fetching/types.ts"
git commit -m "feat: add typed contracts for platform data hooks (PullQueryResult, SubscriptionQueryResult, MutationResult)"
```

---

## Task 2: `useFetchHook` primitive

**Files:**
- Create: `hooks/useFetchHook.ts`
- Create: `tests/unit/useFetchHook.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/useFetchHook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase client — useFetchHook uses auth.currentUser?.getIdToken()
vi.mock('@/lib/firebase/client', () => ({
  auth: { currentUser: { getIdToken: async () => 'mock-token' } },
}));

// renderHook requires @testing-library/react — check if installed first
// If not installed: yarn add -D @testing-library/react
import { renderHook, waitFor, act } from '@testing-library/react';
import { useFetchHook } from '@/hooks/useFetchHook';

describe('useFetchHook', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('starts in loading state', () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const { result } = renderHook(() => useFetchHook(fetcher, null, [], true));
    expect(result.current.loading).toBe(true);
  });

  it('calls fetcher and sets data on success', async () => {
    const fetcher = vi.fn().mockResolvedValue('hello');
    const { result } = renderHook(() => useFetchHook(fetcher, null, [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe('hello');
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetcher throws', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('oops'));
    const { result } = renderHook(() => useFetchHook(fetcher, null, [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error?.message).toBe('oops');
    expect(result.current.data).toBeNull();
  });

  it('skips fetch when enabled is false, resolves immediately with emptyValue', async () => {
    const fetcher = vi.fn();
    const { result } = renderHook(() => useFetchHook(fetcher, [], [], false));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetcher).not.toHaveBeenCalled();
    expect(result.current.data).toEqual([]);
  });

  it('refresh re-triggers the fetcher', async () => {
    let callCount = 0;
    const fetcher = vi.fn().mockImplementation(async () => ++callCount);
    const { result } = renderHook(() => useFetchHook(fetcher, 0, [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(1);

    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(2);
  });

  it('normalises non-Error thrown values into an Error', async () => {
    const fetcher = vi.fn().mockRejectedValue('string error');
    const { result } = renderHook(() => useFetchHook(fetcher, null, [], true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Check if @testing-library/react is installed**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
cat package.json | grep testing-library
```

If not present: `yarn add -D @testing-library/react`

- [ ] **Step 3: Run test to verify it fails (hook doesn't exist yet)**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/useFetchHook.test.ts 2>&1 | tail -10
```

Expected: error about missing module `@/hooks/useFetchHook`.

- [ ] **Step 4: Implement `useFetchHook`**

```typescript
// hooks/useFetchHook.ts
'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PullQueryResult } from '@/lib/data-fetching/types';

/**
 * Shared primitive for HTTP-based platform hooks.
 *
 * @param fetcher  Async function that returns the data. Must be stable or
 *                 change only when `deps` changes (same contract as useCallback).
 * @param emptyValue  Returned as `data` when `enabled` is false or before first fetch.
 * @param deps     Dependency array — same as useCallback/useEffect.
 * @param enabled  When false, fetch is skipped and emptyValue is returned immediately.
 *                 Use `!!userId` to gate on authentication.
 */
export function useFetchHook<T>(
  fetcher: () => Promise<T>,
  emptyValue: T,
  deps: unknown[],
  enabled = true,
): PullQueryResult<T> {
  const [data, setData] = useState<T>(emptyValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(emptyValue);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(emptyValue);
    } finally {
      setLoading(false);
    }
  // deps spread is intentional — callers control re-run via deps array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/useFetchHook.test.ts 2>&1 | tail -15
```

Expected: all 6 tests PASS.

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "useFetchHook"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add "hooks/useFetchHook.ts" "tests/unit/useFetchHook.test.ts"
git commit -m "feat: add useFetchHook primitive to eliminate HTTP hook boilerplate"
```

---

## Task 3: Migrate `app/wk-2026/hooks.ts`

**Files:**
- Modify: `app/wk-2026/hooks.ts`

- [ ] **Step 1: Rewrite both hooks using `useFetchHook`**

Replace the entire contents of `app/wk-2026/hooks.ts` with:

```typescript
"use client";

import { auth } from "@/lib/firebase/client";
import { WK_2026_SEASON, Wk2026Participant, Wk2026SubLeague } from "./types";
import { useFetchHook } from "@/hooks/useFetchHook";
import type { PullQueryResult } from "@/lib/data-fetching/types";

// ---------------------------------------------------------------------------
// useWk2026Participant
// ---------------------------------------------------------------------------

type ParticipantResult = PullQueryResult<Wk2026Participant | null> & {
  isParticipant: boolean;
};

export function useWk2026Participant(
  userId: string | null,
  season: number = WK_2026_SEASON,
): ParticipantResult {
  const result = useFetchHook<Wk2026Participant | null>(
    async () => {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/wk-2026/join?season=${season}`, {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK participant");
      }
      return data.isParticipant ? (data.participant as Wk2026Participant) : null;
    },
    null,
    [season, userId],
    !!userId,
  );

  return { ...result, isParticipant: !!result.data };
}

// ---------------------------------------------------------------------------
// useWk2026SubLeagues
// ---------------------------------------------------------------------------

type SubLeaguesResult = PullQueryResult<Wk2026SubLeague[]> & {
  /** @deprecated Use `data` instead. Kept for backward compatibility. */
  subLeagues: Wk2026SubLeague[];
};

export function useWk2026SubLeagues(
  userId: string | null,
  season: number = WK_2026_SEASON,
): SubLeaguesResult {
  const result = useFetchHook<Wk2026SubLeague[]>(
    async () => {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/wk-2026/subleagues", {
        headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
      });
      const data = await response.json();
      if (!response.ok && response.status !== 401) {
        throw new Error(data.error || "Failed to fetch WK subleagues");
      }
      return ((data.data || []) as Wk2026SubLeague[])
        .filter((league) => league.season === season)
        .sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));
    },
    [],
    [season, userId],
    !!userId,
  );

  return { ...result, subLeagues: result.data };
}
```

Note: `subLeagues` is kept as a backward-compat alias on the return object so existing call sites don't break. It points to `result.data` and can be removed once all consumers are updated.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "wk-2026/hooks"
```

Expected: no output.

- [ ] **Step 3: Check the preview server for runtime errors**

Navigate to `http://localhost:3210/wk-2026` and check:
```bash
# Check server logs for errors
```

Or use `preview_logs` to check for 500s.

- [ ] **Step 4: Commit**

```bash
git add "app/wk-2026/hooks.ts"
git commit -m "refactor: migrate wk-2026 hooks to useFetchHook, add PullQueryResult types"
```

---

## Task 4: Add return type annotations to F1 snapshot hooks

**Files:**
- Modify: `app/f1/hooks/useF1Data.ts`
- Modify: `app/f1/hooks/useF1Standings.ts`

No implementation changes — only add `SubscriptionQueryResult<T>` return types. This makes TypeScript enforce the contract going forward.

- [ ] **Step 1: Update `useF1Standings.ts` — add return types to all three hooks**

In `app/f1/hooks/useF1Standings.ts`, add the import and update each function signature:

```typescript
// Add to imports at top:
import type { SubscriptionQueryResult } from '@/lib/data-fetching/types';

// useF1Standings: change return type
export function useF1Standings(season: number = CURRENT_SEASON, subLeagueId?: string): SubscriptionQueryResult<F1Standing[]> {
  // ... no implementation changes ...
  return { standings: standingsData, loading, error }; // ← NOTE: must rename to `data`
}
```

Wait — `standings` must become `data` to satisfy `SubscriptionQueryResult<F1Standing[]>`.

**Backward-compat approach** (same as wk-2026): return both `data` and the named alias:

```typescript
export function useF1Standings(
  season: number = CURRENT_SEASON,
  subLeagueId?: string,
): SubscriptionQueryResult<F1Standing[]> & { standings: F1Standing[] } {
  // ... unchanged implementation, just change final return:
  return { data: standingsData, standings: standingsData, loading, error };
}

export function useF1UserStanding(
  season: number = CURRENT_SEASON,
): SubscriptionQueryResult<F1Standing | null> & { standing: F1Standing | null } {
  // ... unchanged, change return:
  return { data: standing, standing, loading, error };
}

export function useF1SubLeagues(): SubscriptionQueryResult<F1SubLeague[]> & { subLeagues: F1SubLeague[] } {
  // ... unchanged, change return:
  return { data: subLeaguesData, subLeagues: subLeaguesData, loading, error };
}
```

- [ ] **Step 2: Update `useF1Data.ts` — add return types**

For each of the hooks in this file, add the same pattern. The hooks and their types:

| Hook | Data type |
|---|---|
| `useF1Season` | `F1Season \| null` |
| `useF1Teams` | `F1Team[]` |
| `useF1Drivers` | `F1Driver[]` |
| `useF1DriversWithTeams` | `F1DriverWithTeam[]` |
| `useF1Races` | `F1Race[]` |
| `useF1Race` | `F1Race \| null` |
| `useF1RaceResult` | `F1RaceResult \| null` |
| `useF1Participant` | `F1Participant \| null` |

Add import at top:
```typescript
import type { SubscriptionQueryResult } from '@/lib/data-fetching/types';
```

For each hook, update:
1. Return type annotation: `): SubscriptionQueryResult<X> & { namedField: X }`
2. Final return statement: `return { data: value, namedField: value, loading, error }`

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "useF1Data|useF1Standings"
```

Expected: no output.

- [ ] **Step 4: Run existing unit tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add "app/f1/hooks/useF1Data.ts" "app/f1/hooks/useF1Standings.ts"
git commit -m "refactor: add SubscriptionQueryResult return type contracts to F1 snapshot hooks"
```

---

## Task 5: Migrate `useF1Prediction` to `SubscriptionWithMutation`

**Files:**
- Modify: `app/f1/hooks/useF1Predictions.ts`

- [ ] **Step 1: Update `useF1Prediction`**

Change:
1. Add import for `SubscriptionWithMutation`
2. Define `SaveArgs` and `SaveResult` types explicitly
3. Rename `savePrediction` → `mutate` internally, keep `savePrediction` as alias
4. Rename `error` on the mutation path to `saveError` (separate from read `error`)
5. Add return type annotation

```typescript
import type { SubscriptionQueryResult, SubscriptionWithMutation } from '@/lib/data-fetching/types';

type SavePredictionArgs = {
  finishOrder: string[];
  polePosition: string | null;
  fastestLap: string | null;
  dnf1: string | null;
  dnf2: string | null;
};

type SavePredictionResult = { success: boolean; error?: string };

export function useF1Prediction(
  round: number,
  season: number = CURRENT_SEASON,
): SubscriptionWithMutation<F1Prediction | null, SavePredictionArgs, SavePredictionResult> & {
  prediction: F1Prediction | null;       // backward-compat alias for `data`
  savePrediction: typeof mutate;         // backward-compat alias for `mutate`
  isAuthenticated: boolean;
} {
  const { user } = useAuth();
  const [data, setData] = useState<F1Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<Error | null>(null);

  // Subscription — unchanged
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const docId = createPredictionDocId(user.uid, season, round);
    const docRef = doc(f1Db, F1_COLLECTIONS.PREDICTIONS, docId);
    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        setData(snapshot.exists() ? (snapshot.data() as F1Prediction) : null);
        setLoading(false);
      },
      (err) => { console.error('Error fetching prediction:', err); setError(err); setLoading(false); }
    );
    return () => unsubscribe();
  }, [user?.uid, season, round]);

  // Mutation
  const mutate = useCallback(async (args: SavePredictionArgs): Promise<SavePredictionResult> => {
    if (!user?.uid) return { success: false, error: 'Not authenticated' };
    setSaving(true);
    setSaveError(null);
    try {
      const raceId = createRaceDocId(season, round);
      const payload = {
        prediction: {
          raceId, season, round,
          finishOrder: args.finishOrder.slice(0, 10),
          polePosition: args.polePosition,
          fastestLap: args.fastestLap,
          dnf1: args.dnf1,
          dnf2: args.dnf2,
          isLocked: false,
        },
      };
      const idToken = await auth.currentUser?.getIdToken();
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (idToken) headers.Authorization = `Bearer ${idToken}`;
      const response = await fetch('/f1/api/predictions', { method: 'POST', headers, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok || !result?.success) throw new Error(result?.error || 'Failed to save prediction');
      return { success: true };
    } catch (err) {
      console.error('Error saving prediction:', err);
      const e = err instanceof Error ? err : new Error('Failed to save prediction');
      setSaveError(e);
      return { success: false, error: e.message };
    } finally {
      setSaving(false);
    }
  }, [user?.uid, season, round]);

  return {
    data,
    prediction: data,           // backward compat
    loading,
    error,
    saving,
    saveError,
    mutate,
    savePrediction: mutate,     // backward compat
    isAuthenticated: !!user?.uid,
  };
}
```

`useF1UserPredictions` already returns `{ predictions, loading, error }` — add type annotation:

```typescript
export function useF1UserPredictions(
  season: number = CURRENT_SEASON,
): SubscriptionQueryResult<F1Prediction[]> & { predictions: F1Prediction[] } {
  // ... unchanged, change return:
  return { data: predictionsData, predictions: predictionsData, loading, error };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "useF1Predictions"
```

Expected: no output.

- [ ] **Step 3: Verify preview — navigate to F1 predictions page**

Check that the prediction page still loads and saves correctly.

- [ ] **Step 4: Run all unit tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add "app/f1/hooks/useF1Predictions.ts"
git commit -m "refactor: migrate useF1Prediction to SubscriptionWithMutation contract"
```

---

## Final verification

- [ ] **Full TypeScript check**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "data-fetching|useFetchHook|wk-2026/hooks|useF1Data|useF1Standings|useF1Predictions"
```

Expected: no output.

- [ ] **All unit tests pass**

```bash
npx vitest run 2>&1 | tail -5
```

- [ ] **Preview smoke test** — visit cycling homepage, WK-2026 page, F1 standings

---

## Notes for implementor

- **`auth.currentUser?.getIdToken()`** inside `useFetchHook` is a temporary placeholder. When RFC #15 (token service) lands, replace it with `authorizedFetch` — it will be a one-line change inside the fetcher functions in `wk-2026/hooks.ts` and `useF1Predictions.ts`.
- **Backward-compat aliases** (`subLeagues`, `standings`, `prediction`, `savePrediction`) should be removed in a follow-up PR once all call sites are migrated to use `data` and `mutate`. Mark them with `@deprecated` JSDoc until then.
- **Do not touch** the `deps` spread inside `useFetchHook`'s `useCallback`. The ESLint warning about exhaustive-deps is expected — the spread is intentional and the ESLint disable comment explains why.
