# Route Handler Factories Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 14 insecure admin routes that trust `adminUserId` from the request body, and eliminate 2 copy-pasted `getCurrentUserId` helpers, by introducing `publicHandler`, `userHandler`, and `adminHandler` factory functions.

**Architecture:** Create `lib/api/handler.ts` with three factory functions and an `ApiError` class. Each factory wraps a handler function, resolves auth/params, and handles errors uniformly. Admin auth delegates to existing `requireAdmin()`. User auth uses `getServerAuth()` directly (mirrors the private `getAuthenticatedUser` in `requireAdmin.ts`). Migrate the 16 affected routes to use the factories.

**Tech Stack:** Next.js App Router route handlers, TypeScript, Firebase Admin Auth, Vitest (node environment)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/api/handler.ts` | **Create** | `publicHandler`, `userHandler`, `adminHandler`, `ApiError` |
| `tests/unit/api-handler.test.ts` | **Create** | Unit tests for `ApiError` class and factory error handling |
| 14 admin routes (body-userId pattern) | **Modify** | Replace `adminUserId` from body + manual auth check with `adminHandler` |
| `app/api/updateLastActive/route.ts` | **Modify** | Replace copy-pasted `getAuthenticatedUserId` with `userHandler` |
| `app/api/f1/join/route.ts` | **Modify** | Replace copy-pasted `getCurrentUserId` with `userHandler` |

---

## Task 1: Create route handler factory

**Files:**
- Create: `lib/api/handler.ts`
- Create: `tests/unit/api-handler.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/unit/api-handler.test.ts
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock requireAdmin — adminHandler calls it internally
vi.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: vi.fn(),
  AdminAuthorizationError: class AdminAuthorizationError extends Error {
    constructor(message: string, public status: number, public code: string) {
      super(message);
    }
  },
}));

// Mock getServerAuth — userHandler calls it
vi.mock('@/lib/firebase/server', () => ({
  getServerAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('invalid token')),
    verifySessionCookie: vi.fn().mockRejectedValue(new Error('invalid cookie')),
  }),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { ApiError, publicHandler, userHandler, adminHandler } from '@/lib/api/handler';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('ApiError', () => {
  it('stores message, status, and code', () => {
    const err = new ApiError('Not found', 404, 'not_found');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
  });

  it('works without code', () => {
    const err = new ApiError('Bad request', 400);
    expect(err.status).toBe(400);
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    expect(new ApiError('x', 500)).toBeInstanceOf(Error);
  });
});

describe('publicHandler', () => {
  it('returns JSON result from fn', async () => {
    const handler = publicHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('converts ApiError to correct HTTP status', async () => {
    const handler = publicHandler('test', async () => {
      throw new ApiError('Missing param', 400, 'bad_input');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing param');
    expect(json.code).toBe('bad_input');
  });

  it('converts unknown errors to 500', async () => {
    const handler = publicHandler('test', async () => {
      throw new Error('db exploded');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('internal_error');
  });
});

describe('userHandler', () => {
  it('returns 401 when no auth provided', async () => {
    const handler = userHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });
});

describe('adminHandler', () => {
  it('returns result when requireAdmin resolves', async () => {
    const { requireAdmin } = await import('@/lib/auth/requireAdmin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      uid: 'admin-uid',
      adminProfile: { userId: 'admin-uid', userType: 'admin', isEnabled: true } as any,
    });
    const handler = adminHandler('test', async ({ uid }) => ({ uid }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'admin-uid' });
  });

  it('converts AdminAuthorizationError to correct HTTP status', async () => {
    const { requireAdmin, AdminAuthorizationError } = await import('@/lib/auth/requireAdmin');
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new AdminAuthorizationError('Forbidden', 403, 'not_admin'),
    );
    const handler = adminHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(json.code).toBe('not_admin');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/api-handler.test.ts 2>&1 | tail -10
```

Expected: FAIL — module `@/lib/api/handler` not found.

- [ ] **Step 3: Create `lib/api/handler.ts`**

```typescript
// lib/api/handler.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin, AdminAuthorizationError } from '@/lib/auth/requireAdmin';
import { getServerAuth } from '@/lib/firebase/server';
import type { AdminProfile } from '@/lib/stats/types';

// ---------------------------------------------------------------------------
// ApiError — throw inside handlers instead of returning NextResponse directly
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type RouteContext = { params?: Promise<Record<string, string>> };

export interface PublicContext {
  request: NextRequest;
  params: Record<string, string>;
}

export interface UserContext extends PublicContext {
  uid: string;
}

export interface AdminContext extends UserContext {
  adminProfile: AdminProfile;
}

type NextRouteHandler = (
  request: NextRequest,
  context?: RouteContext,
) => Promise<NextResponse>;

function handleError(label: string, error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, ...(error.code ? { code: error.code } : {}) },
      { status: error.status },
    );
  }
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error(`[${label}] error:`, error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'internal_error' },
    { status: 500 },
  );
}

async function resolveParams(context?: RouteContext): Promise<Record<string, string>> {
  if (!context?.params) return {};
  return await context.params;
}

/**
 * Extracts UID from Bearer token or session cookie.
 * Mirrors the private getAuthenticatedUser() in lib/auth/requireAdmin.ts.
 * Throws ApiError(401) if neither is valid.
 */
async function getAuthenticatedUid(request: NextRequest): Promise<string> {
  const auth = getServerAuth();

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const decoded = await auth.verifyIdToken(authHeader.slice(7));
      return decoded.uid;
    } catch {
      // fall through to session cookie
    }
  }

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (sessionCookie) {
      const decoded = await auth.verifySessionCookie(sessionCookie);
      return decoded.uid;
    }
  } catch {
    // fall through
  }

  throw new ApiError('Authentication required', 401, 'unauthenticated');
}

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/**
 * For routes that need no authentication.
 * Still wraps try/catch and converts thrown ApiError to correct HTTP status.
 */
export function publicHandler(
  label: string,
  fn: (ctx: PublicContext) => Promise<unknown>,
): NextRouteHandler {
  return async (request, context) => {
    try {
      const params = await resolveParams(context);
      const result = await fn({ request, params });
      return NextResponse.json(result);
    } catch (error) {
      return handleError(label, error);
    }
  };
}

/**
 * For routes that require a logged-in user.
 * ctx.uid is the authenticated user's Firebase UID (from Bearer token or session cookie).
 */
export function userHandler(
  label: string,
  fn: (ctx: UserContext) => Promise<unknown>,
): NextRouteHandler {
  return async (request, context) => {
    try {
      const params = await resolveParams(context);
      const uid = await getAuthenticatedUid(request);
      const result = await fn({ request, params, uid });
      return NextResponse.json(result);
    } catch (error) {
      return handleError(label, error);
    }
  };
}

/**
 * For routes that require admin access.
 * ctx.uid is from the verified token (NOT from the request body).
 * ctx.adminProfile is loaded and verified — route runs only if admin is enabled.
 *
 * Security note: NEVER read userId/adminUserId from request.json() and pass it to
 * Firestore for auth verification. Use ctx.uid from this context instead.
 */
export function adminHandler(
  label: string,
  fn: (ctx: AdminContext) => Promise<unknown>,
): NextRouteHandler {
  return async (request, context) => {
    try {
      const params = await resolveParams(context);
      const { uid, adminProfile } = await requireAdmin(request);
      const result = await fn({ request, params, uid, adminProfile });
      return NextResponse.json(result);
    } catch (error) {
      return handleError(label, error);
    }
  };
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run tests/unit/api-handler.test.ts 2>&1 | tail -15
```

Expected: 9 tests PASS (3 ApiError + 3 publicHandler + 1 userHandler + 2 adminHandler).

- [ ] **Step 5: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep "api/handler\|api-handler"
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "lib/api/handler.ts" "tests/unit/api-handler.test.ts"
git commit -m "feat: add route handler factories (publicHandler, userHandler, adminHandler) with ApiError"
```

---

## Task 2: Fix insecure admin routes — body-userId pattern

**Files (14 routes):**
- `app/api/admin/delete-period-bids/route.ts`
- `app/api/admin/preview-bid-backup/route.ts`
- `app/api/admin/preview-delete-bids/route.ts`
- `app/api/admin/send-bid-backup/route.ts`
- `app/api/admin/update-race-fields/route.ts`
- `app/api/changeUserType/route.ts`
- `app/api/createRace/route.ts`
- `app/api/deleteUser/route.ts`
- `app/api/gameParticipants/[participantId]/assignDivision/route.ts`
- `app/api/games/[gameId]/full-grid/rider-values/route.ts`
- `app/api/games/[gameId]/lineup/route.ts`
- `app/api/games/cleanup-orphaned-participants/route.ts`
- `app/api/initializeRaces/route.ts`
- `app/api/raceLineups/[raceSlug]/route.ts`

**Read each file before modifying it.**

### Migration pattern

```typescript
// ─── BEFORE ────────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

export async function POST(request: NextRequest) {
  try {
    const { adminUserId, field1, field2 } = await request.json();

    if (!adminUserId) {
      return NextResponse.json({ error: 'Admin user ID required' }, { status: 400 });
    }

    const db = getServerFirebase();
    const adminDoc = await db.collection('users').doc(adminUserId).get();
    if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!field1) {
      return NextResponse.json({ error: 'field1 required' }, { status: 400 });
    }

    // ... business logic using adminUserId in logs or data ...
    await db.collection('activityLogs').add({
      userId: adminUserId,
      // ...
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error doing thing:', error);
    return NextResponse.json({ error: 'Failed', details: error instanceof Error ? error.message : '' }, { status: 500 });
  }
}

// ─── AFTER ─────────────────────────────────────────────────────────────────
import { adminHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';

export const POST = adminHandler('descriptive-label', async ({ uid, request }) => {
  // ✅ adminUserId REMOVED from body — uid comes from verified token
  const { field1, field2 } = await request.json();

  if (!field1) throw new ApiError('field1 required', 400);

  const db = getServerFirebase();

  // If you need admin user data (email, name) for activity logs, fetch using uid:
  // const adminDoc = await db.collection('users').doc(uid).get();
  // const adminData = adminDoc.data();

  // Replace adminUserId with uid everywhere:
  await db.collection('activityLogs').add({
    userId: uid,       // was adminUserId
    // ...
  });

  return { success: true }; // factory wraps in NextResponse.json automatically
});
```

### Special case: routes with params (dynamic routes)

Routes like `app/api/gameParticipants/[participantId]/assignDivision/route.ts` have URL params:

```typescript
// Before:
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantId: string }> }
) {
  const { participantId } = await context.params;
  // ...
}

// After:
export const POST = adminHandler('assign-division', async ({ uid, request, params }) => {
  const { participantId } = params; // ctx.params is pre-resolved by the factory
  // ...
});
```

### Special case: routes with multiple HTTP methods

For files with both POST and DELETE (or multiple methods):

```typescript
export const POST = adminHandler('label-post', async ({ uid, request, params }) => {
  // ...
});

export const DELETE = adminHandler('label-delete', async ({ uid, request, params }) => {
  // ...
});
```

### Special case: adminUserId from query params (DELETE in assignDivision)

`assignDivision/route.ts` DELETE method reads `adminUserId` from query params:
```typescript
const adminUserId = searchParams.get('adminUserId'); // ← REMOVE THIS
```

After migration, `uid` comes from `ctx.uid` — remove the query param entirely.

### Special case: custom error-logging catch blocks in assignDivision

`assignDivision/route.ts` has inner `catch` blocks that log errors to Firestore `activityLogs` using `adminUserId`. These catch blocks:
- In POST: call `request.json()` again (body already consumed — would throw) and read `adminUserId` from it
- In DELETE: read `adminUserId` from query params

**Remove these inner catch blocks entirely.** The `adminHandler` factory logs to `console.error` and returns a 500 response. The custom Firestore error-activity-logging is intentionally dropped as part of this migration (it was already broken by body-re-read in the POST case).

The POST success path also fetches `adminDoc` (e.g. `adminDoc.data()?.userEmail`, `adminDoc.data()?.userName`) for activity log fields. Apply the general rule (Important note #3): keep this fetch but point it to `uid`:
```typescript
const adminDoc = await db.collection('users').doc(uid).get(); // was adminUserId
```

### Special case: `deleteUser/route.ts` — adminUserId used in self-deletion check and activity logs

```typescript
// Before:
if (adminUserId === targetUserId) throw new Error('...');

// After:
if (uid === targetUserId) throw new ApiError('Je kunt jezelf niet verwijderen', 400);
```

This route also fetches `adminDoc` (originally the auth check line: `db.collection('users').doc(adminUserId).get()`) and then uses `adminDoc.data()?.email` and `adminDoc.data()?.playername` in the `activityLogs` write. **Do NOT remove this fetch** — keep it but point it to `uid` instead of `adminUserId`:

```typescript
// Before (was both auth check AND data source):
const adminDoc = await db.collection('users').doc(adminUserId).get();
if (!adminDoc.exists || adminDoc.data()?.userType !== 'admin') { ... } // ← remove entire block

// After (data fetch only, auth is now in adminHandler):
const adminDoc = await db.collection('users').doc(uid).get();
// Keep using adminDoc.data()?.email, adminDoc.data()?.playername below
```

### Important notes for ALL routes

1. **Remove `adminUserId` validation** — the check `if (!adminUserId) return 400` is no longer needed (factory handles auth)
2. **Remove the Firestore admin auth check** — `db.collection('users').doc(adminUserId).get()` for auth is replaced by `adminHandler`
3. **Keep `adminDoc` fetch if needed for non-auth data** — if the route uses `adminDoc.data()` for activity logs (email, name), keep a Firestore fetch but use `uid` instead of `adminUserId`: `db.collection('users').doc(uid).get()`
4. **Replace `return NextResponse.json({ error: '...' }, { status: N })` with `throw new ApiError('...', N)`**
5. **Replace `adminUserId` references in data writes** (`deletedBy: adminUserId` → `deletedBy: uid`, etc.)
6. **Remove the try/catch block** — factory handles it
7. **Return plain object instead of `NextResponse.json(...)`** — factory wraps it

- [ ] **Step 1: Migrate all 14 admin route files**

For each file:
1. Read the file
2. Apply the migration pattern above
3. Verify it compiles (run tsc check after each batch or at the end)

- [ ] **Step 2: Verify TypeScript — no errors in migrated files**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "changeUserType|deleteUser|createRace|assignDivision|full-grid|lineup|cleanup|initializeRaces|raceLineups|delete-period|preview-bid|send-bid|update-race|cleanup-orphaned"
```

Expected: no output.

- [ ] **Step 3: Verify no more body-adminUserId patterns remain in the 14 migrated files**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
grep "adminUserId" \
  "app/api/admin/delete-period-bids/route.ts" \
  "app/api/admin/preview-bid-backup/route.ts" \
  "app/api/admin/preview-delete-bids/route.ts" \
  "app/api/admin/send-bid-backup/route.ts" \
  "app/api/admin/update-race-fields/route.ts" \
  "app/api/changeUserType/route.ts" \
  "app/api/createRace/route.ts" \
  "app/api/deleteUser/route.ts" \
  "app/api/gameParticipants/[participantId]/assignDivision/route.ts" \
  "app/api/games/[gameId]/full-grid/rider-values/route.ts" \
  "app/api/games/[gameId]/lineup/route.ts" \
  "app/api/games/cleanup-orphaned-participants/route.ts" \
  "app/api/initializeRaces/route.ts" \
  "app/api/raceLineups/[raceSlug]/route.ts"
```

Expected: no output (all body-userId patterns removed from the migrated files).

**Note:** Other `app/api/` routes may still reference `adminUserId` (e.g., for logging after already using proper auth). Those are out of scope for this plan and should be audited separately.

- [ ] **Step 4: Run all tests**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add -A -- 'app/api/admin/delete-period-bids/route.ts' \
              'app/api/admin/preview-bid-backup/route.ts' \
              'app/api/admin/preview-delete-bids/route.ts' \
              'app/api/admin/send-bid-backup/route.ts' \
              'app/api/admin/update-race-fields/route.ts' \
              'app/api/changeUserType/route.ts' \
              'app/api/createRace/route.ts' \
              'app/api/deleteUser/route.ts' \
              'app/api/gameParticipants/[participantId]/assignDivision/route.ts' \
              'app/api/games/[gameId]/full-grid/rider-values/route.ts' \
              'app/api/games/[gameId]/lineup/route.ts' \
              'app/api/games/cleanup-orphaned-participants/route.ts' \
              'app/api/initializeRaces/route.ts' \
              'app/api/raceLineups/[raceSlug]/route.ts'
git commit -m "fix: replace body-adminUserId auth pattern with adminHandler (security fix)"
```

---

## Task 3: Migrate copy-pasted getCurrentUserId routes

**Files:**
- `app/api/updateLastActive/route.ts` — has local `getAuthenticatedUserId()`
- `app/api/f1/join/route.ts` — has local `getCurrentUserId()`

Both have a local copy of the Bearer-token + session-cookie auth pattern.

### `app/api/updateLastActive/route.ts` migration

**Before (52 lines):**
```typescript
async function getAuthenticatedUserId(request): Promise<string | null> { ... }

export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = getServerFirebase();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await userRef.update({ lastActiveAt: Timestamp.now() });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating last active:', error);
    return NextResponse.json({ error: '...', details: '...' }, { status: 500 });
  }
}
```

**After (10 lines):**
```typescript
import { userHandler, ApiError } from '@/lib/api/handler';
import { getServerFirebase } from '@/lib/firebase/server';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = userHandler('update-last-active', async ({ uid }) => {
  const db = getServerFirebase();
  const userRef = db.collection('users').doc(uid);
  if (!(await userRef.get()).exists) throw new ApiError('User not found', 404);
  await userRef.update({ lastActiveAt: Timestamp.now() });
  return { success: true };
});
```

- Delete the `getAuthenticatedUserId` helper function.
- Delete `import { NextResponse } from 'next/server'` if no longer needed (check).

**Note on behavior change:** The original `getAuthenticatedUserId` only checked the `Authorization: Bearer` header. The `userHandler` factory also checks the session cookie as a fallback. This is intentional — it aligns the route with the rest of the auth infrastructure.

### `app/api/f1/join/route.ts` migration

This file has `GET` and `POST` handlers, both using `getCurrentUserId()`.

**Pattern for GET:**
```typescript
// Before:
const userId = await getCurrentUserId(request);
if (!userId) return NextResponse.json({ success: false, error: 'Not authenticated', isParticipant: false }, { status: 401 });

// After (in userHandler):
// uid is always present — userHandler returns 401 automatically
// Just use uid directly
```

**Pattern for POST:**
Same — replace `userId` with `uid` from context, remove the null check.

**Return shapes**: The existing handlers return `{ success: false, error: '...' }` on error. With `userHandler`, these become `throw new ApiError('...', N)`. The factory returns `{ error: '...' }` on error — no `success: false` field. **Check if client code relies on `success: false`.**

Looking at the client (`app/f1/page.tsx`):
```typescript
const data = await response.json();
if (!data.success) {
  alert(data.error || 'Er ging iets mis bij het aanmelden');
}
```
The check `!data.success` works for both `{ success: false }` and `{ error: '...' }` (no `success` field → falsy). ✅ Safe to migrate.

**Migration:**
```typescript
import { userHandler, ApiError } from '@/lib/api/handler';

// Delete the getCurrentUserId() helper function.

export const GET = userHandler('f1-join-check', async ({ uid, request }) => {
  const { searchParams } = new URL(request.url);
  const season = parseInt(searchParams.get('season') || '2026');

  // Replace `userId` with `uid` throughout
  // Replace `return NextResponse.json({ success: false, error: '...' }, { status: N })` with
  // `throw new ApiError('...', N)` for errors
  // Return plain objects for success

  return {
    success: true,
    isParticipant: false,
    registrationOpen,
    gameId,
  };
});

export const POST = userHandler('f1-join', async ({ uid, request }) => {
  // ... same pattern
  return { success: true, data: { ... } };
});
```

**Note**: Keep `const db = getServerFirebase();` and `const f1Db = getServerFirebaseF1();` at module level (they're already there). After deleting `getCurrentUserId`, also remove:
- The `import { getServerAuth } from '@/lib/firebase/server'` import (used only inside the deleted helper)
- The `import { cookies } from 'next/headers'` import (used only inside the deleted helper)

- [ ] **Step 1: Migrate `updateLastActive/route.ts`**

- [ ] **Step 2: Migrate `f1/join/route.ts`** (careful: 2 handlers, complex logic, read the full file first)

- [ ] **Step 3: Verify TypeScript**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx tsc --noEmit 2>&1 | grep -E "updateLastActive|f1/join"
```

Expected: no output.

- [ ] **Step 4: Verify no copy-pasted getCurrentUserId remains**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
grep -r "getCurrentUserId\|getAuthenticatedUserId" app/api/ --include="*.ts"
```

Expected: no output.

- [ ] **Step 5: Run all tests**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
npx vitest run 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/jasperhuting/Documents/projecten/oracle games/oracle-games"
git add "app/api/updateLastActive/route.ts" "app/api/f1/join/route.ts"
git commit -m "refactor: replace copy-pasted getCurrentUserId helpers with userHandler"
```

---

## Notes for implementor

- **`lib/auth/requireAdmin.ts`** is NOT modified — `adminHandler` imports `requireAdmin()` from it as-is.
- **`lib/types/api-responses.ts`**: The `adminUserId` fields in request interfaces can remain for now — removing them is a follow-up cleanup once all callers are updated. Do NOT touch that file in this plan.
- **Client response shapes**: The factory wraps successful return values in `NextResponse.json` with status 200. Error responses use `{ error, code }` shape. Existing client code that checks `response.ok` or `data.success` or `data.error` remains compatible.
- **`NextRequest` import**: After migration, if a route file no longer uses `NextRequest` directly (all request handling moves to factory), check if the import can be removed.
- **`requireAdmin` already handles 7 admin routes** in `app/api/admin/stats/` correctly — those files are NOT touched in this plan.
- **Pre-existing TypeScript error in `full-grid/rider-values/route.ts`**: A type mismatch (`teamClass?: string | undefined` not assignable to `teamClass: string`) exists before this migration. If `tsc --noEmit` reports it after migration, it is a pre-existing issue — not introduced by this plan. Fix it in passing if trivial, otherwise leave it and note it.
