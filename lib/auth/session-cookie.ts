const SHARED_COOKIE_DOMAIN = ".oracle-games.online";
const SHARED_LOCAL_COOKIE_DOMAIN = ".oracle-games.local";

function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

export function getSharedCookieDomain(host: string | null | undefined): string | undefined {
  const normalizedHost = normalizeHost(host);

  if (!normalizedHost || normalizedHost === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(normalizedHost)) {
    return undefined;
  }

  if (normalizedHost === "oracle-games.online" || normalizedHost.endsWith(".oracle-games.online")) {
    return SHARED_COOKIE_DOMAIN;
  }

  if (normalizedHost === "oracle-games.local" || normalizedHost.endsWith(".oracle-games.local")) {
    return SHARED_LOCAL_COOKIE_DOMAIN;
  }

  return undefined;
}

export function getSessionCookieOptions(host: string | null | undefined, persistent: boolean) {
  const domain = getSharedCookieDomain(host);

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    ...(domain ? { domain } : {}),
    ...(persistent ? { maxAge: 60 * 60 * 24 * 14 } : {}),
  };
}
