import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/server";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("session")?.value;

    if (!sessionCookie) {
      return NextResponse.json({ customToken: null }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie);
    const customToken = await adminAuth.createCustomToken(decodedToken.uid);

    return NextResponse.json({ customToken });
  } catch (error) {
    console.error("Error restoring shared session:", error);
    return NextResponse.json({ customToken: null }, { status: 401 });
  }
}
