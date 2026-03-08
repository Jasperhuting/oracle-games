export const PUBLIC_ROUTES = ['/login', '/register', '/reset-password', '/verify-email'] as const;

export function isPublicRoute(pathname: string | null | undefined): boolean {
  return !!pathname && PUBLIC_ROUTES.includes(pathname as (typeof PUBLIC_ROUTES)[number]);
}
