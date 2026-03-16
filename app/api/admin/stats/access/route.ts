import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import { resolveAllowedGameOptions } from "@/lib/stats/repository";

export async function GET(request: NextRequest) {
  try {
    const { adminProfile, uid, tokenSource } = await requireAdmin(request);
    const availableGames = await resolveAllowedGameOptions(adminProfile.allowedGames);

    return NextResponse.json({
      ok: true,
      uid,
      tokenSource,
      adminProfile,
      availableGames,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
