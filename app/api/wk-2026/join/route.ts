import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerAuth, getServerFirebase, getServerFirebaseFootball } from "@/lib/firebase/server";
import {
  createWkParticipantDocId,
  WK2026_COLLECTIONS,
  WK_2026_SEASON,
  Wk2026Participant,
} from "@/app/wk-2026/types";

const db = getServerFirebase();
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
        console.error("WK join ID token verification failed:", error);
      }
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("session")?.value;
    if (!sessionCookie) return null;

    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    return decodedToken.uid;
  } catch (error) {
    console.error("WK join auth error:", error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated", isParticipant: false },
        { status: 401 },
      );
    }

    const season = Number(new URL(request.url).searchParams.get("season") || WK_2026_SEASON);
    const participantId = createWkParticipantDocId(userId, season);
    const participantDoc = await footballDb
      .collection(WK2026_COLLECTIONS.PARTICIPANTS)
      .doc(participantId)
      .get();

    if (participantDoc.exists) {
      return NextResponse.json({
        success: true,
        isParticipant: true,
        participant: {
          id: participantDoc.id,
          ...participantDoc.data(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      isParticipant: false,
    });
  } catch (error) {
    console.error("Error checking WK participation:", error);
    return NextResponse.json(
      { success: false, error: "Failed to check participation status" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const season = Number(body.season || WK_2026_SEASON);
    const participantId = createWkParticipantDocId(userId, season);

    const existingParticipant = await footballDb
      .collection(WK2026_COLLECTIONS.PARTICIPANTS)
      .doc(participantId)
      .get();

    if (existingParticipant.exists) {
      return NextResponse.json(
        { success: false, error: "Je doet al mee aan WK 2026" },
        { status: 400 },
      );
    }

    const userDoc = await db.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const displayName =
      body.displayName ||
      userData?.playername ||
      userData?.name ||
      userData?.displayName ||
      "Anonymous";

    const participant: Omit<Wk2026Participant, "id"> = {
      userId,
      season,
      displayName,
      joinedAt: new Date() as unknown as import("firebase/firestore").Timestamp,
      status: "active",
    };

    await footballDb.collection(WK2026_COLLECTIONS.PARTICIPANTS).doc(participantId).set(participant);

    return NextResponse.json({
      success: true,
      participant: {
        id: participantId,
        ...participant,
      },
    });
  } catch (error) {
    console.error("Error joining WK 2026:", error);
    return NextResponse.json(
      { success: false, error: "Aanmelden voor WK 2026 is mislukt" },
      { status: 500 },
    );
  }
}
