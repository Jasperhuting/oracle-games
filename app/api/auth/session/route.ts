import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/server";
import { getSessionCookieOptions } from "@/lib/auth/session-cookie";

const SESSION_EXPIRES_IN = 60 * 60 * 24 * 14 * 1000;

export async function POST(request: NextRequest) {
  try {
    const { idToken, persistent = true } = await request.json();

    if (!idToken || typeof idToken !== "string") {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    await adminAuth.verifyIdToken(idToken);
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_EXPIRES_IN,
    });

    const response = NextResponse.json({ success: true });
    response.cookies.set(
      "session",
      sessionCookie,
      getSessionCookieOptions(request.headers.get("host"), Boolean(persistent)),
    );

    return response;
  } catch (error) {
    console.error("Error creating shared session cookie:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.set("session", "", {
    ...getSessionCookieOptions(request.headers.get("host"), true),
    maxAge: 0,
  });
  return response;
}
