import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import {
  deleteGeneratedStat,
  getGeneratedStatById,
} from "@/lib/stats/repository";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ resultId: string }> }
) {
  try {
    const { resultId } = await context.params;
    const result = await getGeneratedStatById(resultId);

    if (!result) {
      return NextResponse.json(
        { error: "Result not found", code: "result_not_found" },
        { status: 404 }
      );
    }

    await requireAdmin(request, { gameId: result.gameId });
    await deleteGeneratedStat(resultId);

    return NextResponse.json({
      ok: true,
      deletedId: resultId,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
