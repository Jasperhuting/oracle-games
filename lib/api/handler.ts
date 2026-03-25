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
