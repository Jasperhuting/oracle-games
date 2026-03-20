import type { User } from "firebase/auth";

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
