import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth } from "@/lib/firebase/admin";
import { getAdminProfile } from "@/lib/auth/getAdminProfile";
import { resolveAllowedGameOptions } from "@/lib/stats/repository";
import type { AdminProfile } from "@/lib/stats/types";

type TokenSource = "authorization" | "session";

export class AdminAuthorizationError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

export interface RequiredAdminContext {
  uid: string;
  adminProfile: AdminProfile;
  tokenSource: TokenSource;
}

async function getAuthenticatedUser(request: NextRequest): Promise<{
  uid: string;
  tokenSource: TokenSource;
}> {
  const auth = getAdminAuth();
  const authHeader = request.headers.get("authorization");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid, tokenSource: "authorization" };
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (sessionCookie) {
    const decoded = await auth.verifySessionCookie(sessionCookie);
    return { uid: decoded.uid, tokenSource: "session" };
  }

  throw new AdminAuthorizationError("Authentication required", 401, "unauthenticated");
}

export async function requireAdmin(
  request: NextRequest,
  options?: { gameId?: string }
): Promise<RequiredAdminContext> {
  let authUser: { uid: string; tokenSource: TokenSource };

  try {
    authUser = await getAuthenticatedUser(request);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      throw error;
    }
    throw new AdminAuthorizationError("Invalid authentication", 401, "invalid_auth");
  }

  const adminProfile = await getAdminProfile(authUser.uid);
  if (!adminProfile) {
    throw new AdminAuthorizationError("Admin profile not found", 403, "missing_admin_profile");
  }

  if (!adminProfile.enabled) {
    throw new AdminAuthorizationError("Admin access disabled", 403, "admin_disabled");
  }

  if (!adminProfile.role) {
    throw new AdminAuthorizationError("Admin role missing", 403, "missing_role");
  }

  const allowedGameOptions = await resolveAllowedGameOptions(adminProfile.allowedGames);
  const resolvedAdminProfile: AdminProfile = {
    ...adminProfile,
    allowedGames: allowedGameOptions.map((game) => game.id),
  };

  if (options?.gameId && !resolvedAdminProfile.allowedGames.includes(options.gameId)) {
    throw new AdminAuthorizationError(
      `Game ${options.gameId} is not allowed for this admin`,
      403,
      "game_not_allowed"
    );
  }

  return {
    uid: authUser.uid,
    adminProfile: resolvedAdminProfile,
    tokenSource: authUser.tokenSource,
  };
}

export function toAdminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthorizationError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    {
      error: error instanceof Error ? error.message : "Internal server error",
      code: "internal_error",
    },
    { status: 500 }
  );
}
