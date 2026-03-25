import { cache } from "react";
import { cookies } from "next/headers";
import { getServerAuth, getServerFirebase } from "@/lib/firebase/server";

/**
 * Returns the authenticated user's uid and admin flag from the session cookie.
 * Wrapped in React cache() so multiple calls within one SSR render tree share
 * a single Firestore read instead of N reads.
 */
export const getSessionUserRole = cache(async function getSessionUserRole() {
  try {
    const sessionCookie = (await cookies()).get("session")?.value;

    if (!sessionCookie) {
      return { uid: null, isAdmin: false };
    }

    const auth = getServerAuth();
    const decodedToken = await auth.verifySessionCookie(sessionCookie);
    const userDoc = await getServerFirebase().collection("users").doc(decodedToken.uid).get();
    const userType = userDoc.data()?.userType;

    return {
      uid: decodedToken.uid,
      isAdmin: userType === "admin",
    };
  } catch {
    return { uid: null, isAdmin: false };
  }
});
