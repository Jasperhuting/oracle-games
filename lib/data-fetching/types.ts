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
