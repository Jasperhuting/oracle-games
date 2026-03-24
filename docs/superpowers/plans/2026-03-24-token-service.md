# Token Service Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 14 scattered `auth.currentUser?.getIdToken()` call sites into a single `authorizedFetch` helper, backed by a ports-and-adapters token service that replaces `vi.mock('@/lib/firebase/client')` in tests.

**Architecture:** Create `ITokenService` port + `FirebaseTokenAdapter` + `MockTokenAdapter` + a registry in `lib/auth/token-service.ts` that exposes `authorizedFetch`. Register `FirebaseTokenAdapter` once in `AppShellProviders`. Migrate all 14 call sites to use `authorizedFetch`. Tests register `MockTokenAdapter` in `beforeEach` — no Firebase mock needed.

**Tech Stack:** TypeScript, React hooks, Next.js App Router, Firebase Auth, Vitest (node environment)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/auth/token-service.port.ts` | **Create** | `ITokenService` interface |
| `lib/auth/adapters/firebase-token-adapter.ts` | **Create** | Wraps `auth.currentUser?.getIdToken()` — only file that imports firebase/client for tokens |
| `lib/auth/adapters/mock-token-adapter.ts` | **Create** | Returns a preset token — zero Firebase imports, used in tests |
| `lib/auth/token-service.ts` | **Create** | Registry (`registerTokenService`, `getTokenService`) + `authorizedFetch` |
| `tests/unit/token-service.test.ts` | **Create** | Unit tests for registry + authorizedFetch |
| `components/AppShellProviders.tsx` | **Modify** | Register `FirebaseTokenAdapter` on mount |
| `components/admin/stats/StatsLabClient.tsx` | **Modify** | Remove local `authorizedFetch`, use shared |
| `components/admin/stats/StatsIdeasClient.tsx` | **Modify** | Same |
| `components/admin/stats/StatsResultsClient.tsx` | **Modify** | Same |
| `components/admin/StatsAdminGuard.tsx` | **Modify** | Replace `user.getIdToken()` + `fetch()` with `authorizedFetch` |
| `components/LastActiveTracker.tsx` | **Modify** | Replace `auth.currentUser?.getIdToken()` + `fetch()` with `authorizedFetch` |
| `app/wk-2026/hooks.ts` | **Modify** | Replace inline `getIdToken()` inside fetchers with `authorizedFetch` |
| `app/f1/hooks/useF1Predictions.ts` | **Modify** | Replace inline `getIdToken()` inside mutation with `authorizedFetch` |
| `app/wk-2026/standings/page.tsx` | **Modify** | Replace all 6 `getIdToken()` calls |
| `app/wk-2026/predictions/page.tsx` | **Modify** | Replace 1 `getIdToken()` call |
| `app/wk-2026/predictions/knockout/page.tsx` | **Modify** | Replace 1 `getIdToken()` call |
| `app/f1/page.tsx` | **Modify** | Replace 1 `getIdToken()` call in `handleJoinF1` |
| `app/f1/standings/page.tsx` | **Modify** | Replace 9 `getIdToken()` calls |
| `app/games/[gameId]/team/[participantId]/page.tsx` | **Modify** | Replace 1 `getIdToken()` call |

---

## Task 1: Token service core

**Files:**
- Create: `lib/auth/token-service.port.ts`
- Create: `lib/auth/adapters/firebase-token-adapter.ts`
- Create: `lib/auth/adapters/mock-token-adapter.ts`
- Create: `lib/auth/token-service.ts`
- Create: `tests/unit/token-service.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/token-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTokenService, getTokenService, authorizedFetch } from '@/lib/auth/token-service';
import { MockTokenAdapter } from '@/lib/auth/adapters/mock-token-adapter';

// Mock global fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('token-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerTokenService(new MockTokenAdapter('test-token'));
  });

  it('MockTokenAdapter returns preset token', async () => {
    const adapter = new MockTokenAdapter('abc');
    expect(await adapter.getToken()).toBe('abc');
  });

  it('MockTokenAdapter returns null when initialized with null', async () => {
    const adapter = new MockTokenAdapter(null);
    expect(await adapter.getToken()).toBeNull();
  });

  it('getTokenService returns the registered service', async () => {
    const token = await getTokenService().getToken();
    expect(token).toBe('test-token');
  });

  it('authorizedFetch adds Authorization header when token is present', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('authorizedFetch does not add Authorization header when token is null', async () => {
    registerTokenService(new MockTokenAdapter(null));
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/public');
    const headers = mockFetch.mock.calls[0][1]?.headers ?? {};
    expect(headers['Authorization']).toBeUndefined();
  });

  it('authorizedFetch forwards init options to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('authorizedFetch merges caller headers with Authorization', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test', {
      headers: { 'Content-Type': 'application/json' },
    });
    const headers = mockFetch.mock.calls[0][1]?.headers ?? {};
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-token');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/token-service.test.ts 2>&1 | tail -10
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Create the port**

```typescript
// lib/auth/token-service.port.ts

export interface ITokenService {
  getToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
}
```

- [ ] **Step 4: Create the adapters**

```typescript
// lib/auth/adapters/firebase-token-adapter.ts
'use client';

import { auth } from '@/lib/firebase/client';
import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Reads tokens from Firebase Auth. This is the only file in the codebase
 * that imports auth from @/lib/firebase/client for token purposes.
 *
 * Works correctly during impersonation: signInWithCustomToken() sets
 * auth.currentUser to the impersonated user, so getIdToken() returns
 * the impersonated user's ID token automatically.
 */
export class FirebaseTokenAdapter implements ITokenService {
  async getToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
    return (await auth.currentUser?.getIdToken(options?.forceRefresh)) ?? null;
  }
}
```

```typescript
// lib/auth/adapters/mock-token-adapter.ts

import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Test double for ITokenService. Zero Firebase imports.
 *
 * Usage in tests:
 *   beforeEach(() => registerTokenService(new MockTokenAdapter('my-test-token')));
 */
export class MockTokenAdapter implements ITokenService {
  constructor(private readonly token: string | null = 'mock-token') {}

  async getToken(_options?: { forceRefresh?: boolean }): Promise<string | null> {
    return this.token;
  }
}
```

- [ ] **Step 5: Create the registry + authorizedFetch**

```typescript
// lib/auth/token-service.ts

import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Default to a no-op service so authorizedFetch works without a token
 * before FirebaseTokenAdapter is registered (e.g. during SSR or first render).
 * Calls proceed without an Authorization header — server returns 401 as expected.
 */
let _service: ITokenService = {
  getToken: async () => null,
};

export function registerTokenService(service: ITokenService): void {
  _service = service;
}

export function getTokenService(): ITokenService {
  return _service;
}

/**
 * Drop-in replacement for fetch() that automatically adds
 * `Authorization: Bearer <token>` when the user is authenticated.
 *
 * IMPORTANT: `init.headers` must be a plain object (Record<string, string>).
 * Passing a `Headers` instance is not supported. All usages in this codebase
 * use plain objects, so this is never an issue in practice.
 *
 * Content-Type is NOT added automatically — callers must include it
 * for POST/PATCH requests:
 *   await authorizedFetch('/api/foo', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await _service.getToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
```

- [ ] **Step 6: Run tests — all should pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/token-service.test.ts 2>&1 | tail -10
```

Expected: 8 tests PASS.

- [ ] **Step 7: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "token-service|token-adapter"
```

Expected: no output.

- [ ] **Step 8: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "lib/auth/token-service.port.ts" "lib/auth/adapters/firebase-token-adapter.ts" "lib/auth/adapters/mock-token-adapter.ts" "lib/auth/token-service.ts" "tests/unit/token-service.test.ts"
git commit -m "feat: add token service with FirebaseTokenAdapter, MockTokenAdapter, and authorizedFetch"
```

---

## Task 2: Register FirebaseTokenAdapter in app shell

**Files:**
- Modify: `components/AppShellProviders.tsx`

- [ ] **Step 1: Add registration to AppShellProviders**

`components/AppShellProviders.tsx` is a `'use client'` component at the root of the app. Add a `useEffect` to register `FirebaseTokenAdapter` once on mount (client-side only — avoids SSR).

Current top of file:
```typescript
'use client';

import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
// ... other imports ...
```

Updated file (full replacement):
```typescript
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import { LayoutShell } from '@/components/LayoutShell';
import { AuthGuard } from '@/components/AuthGuard';
import MessageNotification from '@/components/MessageNotification';
import { LastActiveTracker } from '@/components/LastActiveTracker';
import { ImpersonationProvider } from '@/contexts/ImpersonationContext';
import { RankingsProvider } from '@/contexts/RankingsContext';
import LanguageWrapper from '@/components/LanguageWrapper';
import { PlayerTeamsProvider } from '@/contexts/PlayerTeamsContext';
import { isPublicRoute } from '@/lib/constants/routes';
import ChatFloatingButton from '@/components/chat/ChatFloatingButton';
import { TabFocusRefresher } from '@/components/TabFocusRefresher';
import { registerTokenService } from '@/lib/auth/token-service';
import { FirebaseTokenAdapter } from '@/lib/auth/adapters/firebase-token-adapter';

export default function AppShellProviders({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicRoute(pathname);

  useEffect(() => {
    registerTokenService(new FirebaseTokenAdapter());
  }, []);

  return (
    <LanguageWrapper>
      <ImpersonationProvider>
        <RankingsProvider autoLoad={!isPublic}>
          <PlayerTeamsProvider autoLoad={!isPublic}>
            <Toaster position="top-center" />
            <TabFocusRefresher />
            {!isPublic && <LastActiveTracker />}
            {!isPublic && <MessageNotification />}
            <AuthGuard>
              {isPublic ? (
                <main>{children}</main>
              ) : (
                <LayoutShell>
                  <main>{children}</main>
                </LayoutShell>
              )}
              {!isPublic && <ChatFloatingButton />}
            </AuthGuard>
          </PlayerTeamsProvider>
        </RankingsProvider>
      </ImpersonationProvider>
    </LanguageWrapper>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "AppShellProviders"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "components/AppShellProviders.tsx"
git commit -m "feat: register FirebaseTokenAdapter in AppShellProviders on mount"
```

---

## Task 3: Migrate component helpers

**Files:**
- Modify: `components/admin/stats/StatsLabClient.tsx`
- Modify: `components/admin/stats/StatsIdeasClient.tsx`
- Modify: `components/admin/stats/StatsResultsClient.tsx`
- Modify: `components/admin/StatsAdminGuard.tsx`
- Modify: `components/LastActiveTracker.tsx`

All five files have the same migration pattern. Read each file first, then apply.

### Migration pattern for stats components (StatsLabClient, StatsIdeasClient, StatsResultsClient)

Each stats component has:
1. A local `authorizedFetch(userToken, input, init?)` helper — **delete it**
2. `useAuth()` that gives `user`
3. `const token = await user.getIdToken();` before each fetch call — **delete it**
4. `await authorizedFetch(token, url, init)` calls — **replace with `await authorizedFetch(url, init)`**

Note: The local `authorizedFetch` helper in `StatsLabClient.tsx` adds `Content-Type: application/json` automatically for ALL calls including POST calls that don't explicitly pass it (see `handleGenerateIdeas` and `handleRunIdea`). After migration, every POST/PATCH call that sends a body must include `Content-Type` explicitly in `init.headers`:
```typescript
// Before:
const token = await user.getIdToken();
const response = await authorizedFetch(token, '/api/admin/stats/something', {
  method: 'POST',
  body: JSON.stringify(payload),
});

// After:
const response = await authorizedFetch('/api/admin/stats/something', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

For GET requests, no `Content-Type` header needed:
```typescript
// Before:
const token = await user.getIdToken();
const response = await authorizedFetch(token, '/api/admin/stats/access', { method: 'GET' });

// After:
const response = await authorizedFetch('/api/admin/stats/access', { method: 'GET' });
```

Add import at the top of each stats file:
```typescript
import { authorizedFetch } from '@/lib/auth/token-service';
```

Remove `import { auth } from '@/lib/firebase/client'` if present.

### Migration pattern for StatsAdminGuard

```typescript
// Before (lines 28-33):
const idToken = await user.getIdToken();
const response = await fetch("/api/admin/stats/access", {
  headers: { Authorization: `Bearer ${idToken}` },
});

// After:
const response = await authorizedFetch("/api/admin/stats/access");
```

Add import:
```typescript
import { authorizedFetch } from '@/lib/auth/token-service';
```

### Migration pattern for LastActiveTracker

```typescript
// Before:
import { auth } from '@/lib/firebase/client';
// ...
const idToken = await auth.currentUser?.getIdToken();
if (!idToken) return;                             // ← delete this line
const response = await fetch('/api/updateLastActive', {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}` },
});

// After:
import { authorizedFetch } from '@/lib/auth/token-service';
// ...
const response = await authorizedFetch('/api/updateLastActive', { method: 'POST' });
// The `if (!user?.uid) return;` guard above is sufficient — no need for the !idToken check
```

Remove `import { auth } from '@/lib/firebase/client'` from LastActiveTracker.

- [ ] **Step 1: Migrate all five component files** (apply patterns above to each)

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "StatsLab|StatsIdeas|StatsResults|StatsAdminGuard|LastActive"
```

Expected: no output.

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 4: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "components/admin/stats/StatsLabClient.tsx" \
        "components/admin/stats/StatsIdeasClient.tsx" \
        "components/admin/stats/StatsResultsClient.tsx" \
        "components/admin/StatsAdminGuard.tsx" \
        "components/LastActiveTracker.tsx"
git commit -m "refactor: replace local authorizedFetch helpers with shared token service"
```

---

## Task 4: Migrate hooks

**Files:**
- Modify: `app/wk-2026/hooks.ts`
- Modify: `app/f1/hooks/useF1Predictions.ts`

### `app/wk-2026/hooks.ts`

This file was migrated in RFC #18 to use `useFetchHook`. The fetcher lambdas still contain inline `getIdToken()` calls. Replace them.

Current pattern in each fetcher:
```typescript
const idToken = await auth.currentUser?.getIdToken();
const response = await fetch(`/api/wk-2026/join?season=${season}`, {
  headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
});
```

After:
```typescript
const response = await authorizedFetch(`/api/wk-2026/join?season=${season}`);
```

Same for the subleagues fetcher. Remove `import { auth } from '@/lib/firebase/client'`. Add `import { authorizedFetch } from '@/lib/auth/token-service'`.

### `app/f1/hooks/useF1Predictions.ts`

The `mutate` function (from RFC #18) contains:
```typescript
const idToken = await auth.currentUser?.getIdToken();
const headers: Record<string, string> = { 'content-type': 'application/json' };
if (idToken) headers.Authorization = `Bearer ${idToken}`;
const response = await fetch('/f1/api/predictions', { method: 'POST', headers, body: JSON.stringify(payload) });
```

After:
```typescript
const response = await authorizedFetch('/f1/api/predictions', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});
```

Remove `import { auth } from '@/lib/firebase/client'` from the file if it was only used for the token. Add `import { authorizedFetch } from '@/lib/auth/token-service'`.

- [ ] **Step 1: Migrate both hook files**

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "wk-2026/hooks|useF1Predictions"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "app/wk-2026/hooks.ts" "app/f1/hooks/useF1Predictions.ts"
git commit -m "refactor: replace inline getIdToken() in hooks with authorizedFetch"
```

---

## Task 5: Migrate wk-2026 page components

**Files:**
- Modify: `app/wk-2026/standings/page.tsx` (6 calls)
- Modify: `app/wk-2026/predictions/page.tsx` (1 call)
- Modify: `app/wk-2026/predictions/knockout/page.tsx` (1 call)

### General migration pattern for all page files

Search each file for the pattern:
```typescript
const idToken = await auth.currentUser?.getIdToken();
```
or:
```typescript
const idToken = await user.getIdToken();
```

For each occurrence, find the `fetch()` call that follows it and replace both with `authorizedFetch()`.

**Pattern 1 — no body (GET):**
```typescript
// Before:
const idToken = await auth.currentUser?.getIdToken();
const response = await fetch('/api/some/endpoint', {
  headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
});

// After:
const response = await authorizedFetch('/api/some/endpoint');
```

**Pattern 2 — with body (POST/PATCH):**
```typescript
// Before:
const idToken = await auth.currentUser?.getIdToken();
const response = await fetch('/api/some/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
  },
  body: JSON.stringify(payload),
});

// After:
const response = await authorizedFetch('/api/some/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
```

For each file:
1. Add `import { authorizedFetch } from '@/lib/auth/token-service'`
2. Remove `import { auth } from '@/lib/firebase/client'` if only used for getIdToken
3. Apply the migration pattern to every `getIdToken()` occurrence

- [ ] **Step 1: Read and migrate all three wk-2026 page files**

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "wk-2026"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "app/wk-2026/standings/page.tsx" \
        "app/wk-2026/predictions/page.tsx" \
        "app/wk-2026/predictions/knockout/page.tsx"
git commit -m "refactor: replace getIdToken() calls in wk-2026 page components with authorizedFetch"
```

---

## Task 6: Migrate f1 and games page components

**Files:**
- Modify: `app/f1/page.tsx` (1 call — in `handleJoinF1`)
- Modify: `app/f1/standings/page.tsx` (9 calls)
- Modify: `app/games/[gameId]/team/[participantId]/page.tsx` (1 call)

Apply the same migration patterns from Task 5 to these three files.

For `app/f1/page.tsx`, the single call is in `handleJoinF1`:
```typescript
// Before:
const idToken = await user.getIdToken();
const response = await fetch('/api/f1/join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  },
  body: JSON.stringify({ season: 2026 }),
});

// After:
const response = await authorizedFetch('/api/f1/join', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ season: 2026 }),
});
```

Remove `user.getIdToken()` call — `user` from `useAuth()` may no longer be needed (check if it's used elsewhere in the file before removing the destructuring).

- [ ] **Step 1: Read and migrate all three files**

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "app/f1|app/games"
```

Expected: no output.

- [ ] **Step 3: Run all tests**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run 2>&1 | tail -10
```

Expected: all passing.

- [ ] **Step 4: Final TypeScript sweep**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | tail -5
```

- [ ] **Step 5: Verify no stray getIdToken calls remain**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
grep -r "getIdToken" app/ components/ hooks/ --include="*.ts" --include="*.tsx"
```

Expected: no output (all migrated). If any remain, migrate them too.
Note: `lib/auth/client-session.ts` intentionally keeps its `getIdToken()` call — it is NOT in the search paths above.

- [ ] **Step 6: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "app/f1/page.tsx" "app/f1/standings/page.tsx" "app/games/[gameId]/team/[participantId]/page.tsx"
git commit -m "refactor: replace getIdToken() calls in f1 and games page components with authorizedFetch"
```

---

## Notes for implementor

- **`lib/auth/client-session.ts`** is intentionally NOT migrated. It calls `user.getIdToken()` where `user` is the Firebase `User` passed by the login flow — a special case at session creation time. It stays as-is.
- **`hooks/useAuth.ts`** imports `auth` from `@/lib/firebase/client` for `onAuthStateChanged`/`signIn`/`signOut` — those are NOT token calls and should NOT be migrated.
- **ESLint rule** to forbid direct `@/lib/firebase/client` imports for tokens is a follow-up task (RFC #15 step 8) — out of scope for this plan.
- **`Content-Type` header**: The old local `authorizedFetch` helpers in stats components added `Content-Type: application/json` automatically. The new shared `authorizedFetch` does NOT — callers must add it explicitly for POST/PATCH requests. The plan handles this in Tasks 3 and 4.
- **Token precedence during impersonation**: `FirebaseTokenAdapter` calls `auth.currentUser?.getIdToken()`. After `signInWithCustomToken()`, `auth.currentUser` is already the impersonated user. So impersonation works transparently — no special handling needed.
