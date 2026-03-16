import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, toAdminErrorResponse } from "@/lib/auth/requireAdmin";
import { updateIdeaInputSchema } from "@/lib/stats/schemas";
import { deleteIdea, getIdeaById, updateIdea } from "@/lib/stats/repository";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  try {
    const { ideaId } = await params;
    const existingIdea = await getIdeaById(ideaId);

    if (!existingIdea) {
      return NextResponse.json({ error: "Idea not found", code: "idea_not_found" }, { status: 404 });
    }

    await requireAdmin(request, { gameId: existingIdea.gameId });
    const body = await request.json();
    const updates = updateIdeaInputSchema.parse(body);

    const savedIdea = await updateIdea(ideaId, updates);

    return NextResponse.json({
      ok: true,
      idea: savedIdea,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ ideaId: string }> }
) {
  try {
    const { ideaId } = await params;
    const existingIdea = await getIdeaById(ideaId);

    if (!existingIdea) {
      return NextResponse.json({ error: "Idea not found", code: "idea_not_found" }, { status: 404 });
    }

    await requireAdmin(request, { gameId: existingIdea.gameId });
    await deleteIdea(ideaId);

    return NextResponse.json({
      ok: true,
      deletedId: ideaId,
    });
  } catch (error) {
    return toAdminErrorResponse(error);
  }
}
