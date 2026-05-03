import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { getServerAuth, getServerFirebaseFootball } from "@/lib/firebase/server";
import { WK2026_COLLECTIONS, WK_2026_SEASON, Wk2026SubLeague } from "@/app/wk-2026/types";

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
        console.error("WK subleague ID token verification failed:", error);
      }
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch (error) {
    console.error("WK subleague auth error:", error);
    return null;
  }
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET(request: NextRequest) {
  try {
    const footballDb = getServerFirebaseFootball();
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const isPublic = searchParams.get("public") === "true";
    const userId = await getCurrentUserId(request);

    const subLeaguesRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES);

    if (code) {
      const snapshot = await subLeaguesRef.where("code", "==", code.toUpperCase()).limit(1).get();
      if (snapshot.empty) {
        return NextResponse.json(
          { success: false, error: "Subpoule niet gevonden" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: { id: snapshot.docs[0].id, ...snapshot.docs[0].data() },
      });
    }

    if (isPublic) {
      const snapshot = await subLeaguesRef.where("isPublic", "==", true).get();
      const data = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() } as Wk2026SubLeague))
        .filter((league) => league.season === WK_2026_SEASON)
        .sort((a, b) => a.name.localeCompare(b.name, "nl-NL"));

      return NextResponse.json({ success: true, data });
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const snapshot = await subLeaguesRef.where("memberIds", "array-contains", userId).get();
    const data = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((league) => league.season === WK_2026_SEASON);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Error fetching WK subleagues:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch subpoules" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const footballDb = getServerFirebaseFootball();
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const isPublic = Boolean(body.isPublic);
    if (name.length < 2) {
      return NextResponse.json(
        { success: false, error: "Geef een naam van minimaal 2 tekens op" },
        { status: 400 },
      );
    }

    const subLeaguesRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES);

    let code = generateCode();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const existing = await subLeaguesRef.where("code", "==", code).limit(1).get();
      if (existing.empty) break;
      code = generateCode();
    }

    const subLeague: Omit<Wk2026SubLeague, "id"> = {
      name,
      code,
      season: Number(body.season || WK_2026_SEASON),
      createdBy: userId,
      memberIds: [userId],
      pendingMemberIds: [],
      isPublic,
      maxMembers: 50,
      createdAt: Timestamp.now() as unknown as import("firebase/firestore").Timestamp,
      updatedAt: Timestamp.now() as unknown as import("firebase/firestore").Timestamp,
      ...(description ? { description } : {}),
    };

    const docRef = await subLeaguesRef.add(subLeague);

    return NextResponse.json({
      success: true,
      data: { id: docRef.id, ...subLeague },
    });
  } catch (error) {
    console.error("Error creating WK subleague:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create subpoule" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const footballDb = getServerFirebaseFootball();
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) {
      return NextResponse.json(
        { success: false, error: "Code is verplicht" },
        { status: 400 },
      );
    }

    const subLeaguesRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES);
    const snapshot = await subLeaguesRef.where("code", "==", code).limit(1).get();
    if (snapshot.empty) {
      return NextResponse.json(
        { success: false, error: "Subpoule niet gevonden" },
        { status: 404 },
      );
    }

    const doc = snapshot.docs[0];
    const subLeague = doc.data() as Wk2026SubLeague;

    if (subLeague.memberIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: "Je zit al in deze subpoule" },
        { status: 400 },
      );
    }

    if (subLeague.memberIds.length >= subLeague.maxMembers) {
      return NextResponse.json(
        { success: false, error: "Deze subpoule zit vol" },
        { status: 400 },
      );
    }

    if (subLeague.isPublic) {
      return NextResponse.json(
        { success: false, error: "Gebruik de publieke aanvragen-flow voor deze subpoule" },
        { status: 400 },
      );
    }

    await doc.ref.update({
      memberIds: FieldValue.arrayUnion(userId),
      updatedAt: Timestamp.now(),
    });

    return NextResponse.json({
      success: true,
      data: { id: doc.id, ...subLeague },
    });
  } catch (error) {
    console.error("Error joining WK subleague:", error);
    return NextResponse.json(
      { success: false, error: "Failed to join subpoule" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const footballDb = getServerFirebaseFootball();
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Subpoule ID is verplicht" },
        { status: 400 },
      );
    }

    const docRef = footballDb.collection(WK2026_COLLECTIONS.SUB_LEAGUES).doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json(
        { success: false, error: "Subpoule niet gevonden" },
        { status: 404 },
      );
    }

    const subLeague = doc.data() as Wk2026SubLeague;
    if (!subLeague.memberIds.includes(userId)) {
      return NextResponse.json(
        { success: false, error: "Je bent geen lid van deze subpoule" },
        { status: 400 },
      );
    }

    if (subLeague.createdBy === userId) {
      await docRef.delete();
      return NextResponse.json({ success: true, data: { deleted: true } });
    }

    await docRef.update({
      memberIds: FieldValue.arrayRemove(userId),
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, data: { left: true } });
  } catch (error) {
    console.error("Error leaving WK subleague:", error);
    return NextResponse.json(
      { success: false, error: "Failed to leave subpoule" },
      { status: 500 },
    );
  }
}
