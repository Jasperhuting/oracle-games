import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerAuth, getServerFirebaseFootball } from "@/lib/firebase/server";
import { WK2026_COLLECTIONS, Wk2026SubLeague } from "@/app/wk-2026/types";

const footballDb = getServerFirebaseFootball();

async function getCurrentUserId(request: NextRequest): Promise<string | null> {
  try {
    const auth = getServerAuth();
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const idToken = authHeader.slice(7);
      try {
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
      } catch (error) {
        console.error("WK subleague action ID token verification failed:", error);
      }
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch (error) {
    console.error("WK subleague action auth error:", error);
    return null;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const doc = await footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES).doc(id).get();

    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Subpoule niet gevonden" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      data: { id: doc.id, ...doc.data() },
    });
  } catch (error) {
    console.error("Error fetching WK subleague:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subpoule" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const docRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Subpoule niet gevonden" }, { status: 404 });
    }

    const subLeague = doc.data() as Wk2026SubLeague;
    if (subLeague.createdBy !== userId) {
      return NextResponse.json({ success: false, error: "Alleen de beheerder kan dit aanpassen" }, { status: 403 });
    }

    const updates: Partial<Wk2026SubLeague> = {
      updatedAt: new Date() as unknown as import("firebase/firestore").Timestamp,
    };

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim() || undefined;
    if (body.isPublic !== undefined) updates.isPublic = Boolean(body.isPublic);
    if (body.maxMembers !== undefined) updates.maxMembers = Number(body.maxMembers);

    await docRef.update(updates);

    return NextResponse.json({
      success: true,
      data: { id: doc.id, ...subLeague, ...updates },
    });
  } catch (error) {
    console.error("Error updating WK subleague:", error);
    return NextResponse.json({ success: false, error: "Failed to update subpoule" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const action = body.action as string;

    const docRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ success: false, error: "Subpoule niet gevonden" }, { status: 404 });
    }

    const subLeague = doc.data() as Wk2026SubLeague;
    const pendingMemberIds = subLeague.pendingMemberIds || [];
    const targetUserId = body.targetUserId as string | undefined;

    switch (action) {
      case "request": {
        if (!subLeague.isPublic) {
          return NextResponse.json(
            { success: false, error: "Deze subpoule is niet publiek. Gebruik een code om te joinen." },
            { status: 400 },
          );
        }
        if (subLeague.memberIds.includes(userId)) {
          return NextResponse.json({ success: false, error: "Je bent al lid van deze subpoule" }, { status: 400 });
        }
        if (pendingMemberIds.includes(userId)) {
          return NextResponse.json({ success: false, error: "Je aanvraag staat al open" }, { status: 400 });
        }
        if (subLeague.memberIds.length >= subLeague.maxMembers) {
          return NextResponse.json({ success: false, error: "Deze subpoule zit vol" }, { status: 400 });
        }

        await docRef.update({
          pendingMemberIds: [...pendingMemberIds, userId],
          updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, message: "Aanvraag verstuurd" });
      }

      case "cancel": {
        if (!pendingMemberIds.includes(userId)) {
          return NextResponse.json({ success: false, error: "Je hebt geen openstaande aanvraag" }, { status: 400 });
        }

        await docRef.update({
          pendingMemberIds: pendingMemberIds.filter((id) => id !== userId),
          updatedAt: new Date(),
        });

        return NextResponse.json({ success: true, message: "Aanvraag geannuleerd" });
      }

      case "approve":
      case "reject": {
        if (subLeague.createdBy !== userId) {
          return NextResponse.json({ success: false, error: "Alleen de beheerder kan aanvragen beheren" }, { status: 403 });
        }
        if (!targetUserId) {
          return NextResponse.json({ success: false, error: "targetUserId is verplicht" }, { status: 400 });
        }
        if (!pendingMemberIds.includes(targetUserId)) {
          return NextResponse.json({ success: false, error: "Deze aanvraag bestaat niet meer" }, { status: 400 });
        }

        const updatePayload: Record<string, unknown> = {
          pendingMemberIds: pendingMemberIds.filter((id) => id !== targetUserId),
          updatedAt: new Date(),
        };

        if (action === "approve") {
          if (subLeague.memberIds.length >= subLeague.maxMembers) {
            return NextResponse.json({ success: false, error: "Deze subpoule zit vol" }, { status: 400 });
          }
          updatePayload.memberIds = [...subLeague.memberIds, targetUserId];
        }

        await docRef.update(updatePayload);

        return NextResponse.json({
          success: true,
          message: action === "approve" ? "Aanvraag goedgekeurd" : "Aanvraag afgewezen",
        });
      }

      default:
        return NextResponse.json({ success: false, error: "Ongeldige actie" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error handling WK subleague action:", error);
    return NextResponse.json({ success: false, error: "Failed to process subpoule action" }, { status: 500 });
  }
}
