export const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/verify-email'] as const;

// Accessible to everyone — no redirect regardless of auth status
const OPEN_ROUTE_PREFIXES = ['/preview', '/news'];

export function isPublicRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number]);
}

export function isOpenRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return OPEN_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}
