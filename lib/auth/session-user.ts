import { cookies } from "next/headers";
import { getServerAuth, getServerFirebase } from "@/lib/firebase/server";

export async function getSessionUserRole() {
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
}
