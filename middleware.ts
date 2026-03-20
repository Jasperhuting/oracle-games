import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildPlatformUrl, getForeignPlatformPathPrefixes, getPlatformConfig, resolvePlatformFromHost } from "@/lib/platform";

const PUBLIC_FILE_REGEX = /\.[^/]+$/;

function shouldBypass(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/.well-known") ||
    PUBLIC_FILE_REGEX.test(pathname)
  );
}

function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").split(":")[0].toLowerCase();
}

function isBareOrWwwOracleHost(host: string | null | undefined): boolean {
  const normalizedHost = normalizeHost(host);

  return (
    normalizedHost === "oracle-games.online" ||
    normalizedHost === "www.oracle-games.online" ||
    normalizedHost === "oracle-games.local" ||
    normalizedHost === "www.oracle-games.local"
  );
}

export function middleware(request: NextRequest) {
  const { nextUrl, headers } = request;
  const pathname = nextUrl.pathname;

  if (shouldBypass(pathname)) {
    return NextResponse.next();
  }

  const { platform, isMatchedSubdomain } = resolvePlatformFromHost(headers.get("host"));

  if (!isMatchedSubdomain && isBareOrWwwOracleHost(headers.get("host"))) {
    return NextResponse.redirect(
      buildPlatformUrl(headers.get("host") ?? "", getPlatformConfig("cycling"), pathname),
    );
  }

  if (!isMatchedSubdomain) {
    return NextResponse.next();
  }

  if (pathname === "/") {
    const redirectUrl = nextUrl.clone();
    const hasSessionCookie = Boolean(request.cookies.get("session")?.value);
    const targetPath = hasSessionCookie
      ? platform.authenticatedEntryPath
      : platform.rootEntryPath;

    if (targetPath === pathname) {
      return NextResponse.next();
    }

    redirectUrl.pathname = targetPath;
    return NextResponse.redirect(redirectUrl);
  }

  if (
    pathname === platform.publicEntryPath ||
    pathname.startsWith(`${platform.publicEntryPath}/`) ||
    pathname === "/preview" ||
    pathname.startsWith("/preview/") ||
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/verify-email" ||
    pathname === "/privacy"
  ) {
    return NextResponse.next();
  }

  const foreignPlatformPrefixes = getForeignPlatformPathPrefixes(platform.key);
  const isForeignPlatformPath = foreignPlatformPrefixes.some((prefix) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isForeignPlatformPath) {
    const redirectUrl = nextUrl.clone();
    redirectUrl.pathname = platform.authenticatedEntryPath;
    return NextResponse.redirect(redirectUrl);
  }

  if (!platform.internalBasePath) {
    return NextResponse.next();
  }

  const basePath = platform.internalBasePath;

  if (pathname === basePath || pathname.startsWith(`${basePath}/`)) {
    return NextResponse.next();
  }

  const rewrittenUrl = nextUrl.clone();
  rewrittenUrl.pathname = `${basePath}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(rewrittenUrl);
}

export const config = {
  matcher: ["/((?!_next/image).*)"],
};
