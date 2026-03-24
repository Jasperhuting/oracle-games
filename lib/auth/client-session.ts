import type { User } from "firebase/auth";

// NOTE: getIdToken() here is intentionally NOT replaced with authorizedFetch.
// The token is the *payload* being sent to create a server-side session cookie,
// not a Bearer header for API authorization. This call site is exempt from RFC #15.
export async function createSharedSession(user: User, persistent = true) {
  const idToken = await user.getIdToken();

  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
      persistent,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to create shared session");
  }
}

export async function clearSharedSession() {
  await fetch("/api/auth/session", {
    method: "DELETE",
  });
}
