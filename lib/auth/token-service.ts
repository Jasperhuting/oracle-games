import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Default to a no-op service so authorizedFetch works without a token
 * before FirebaseTokenAdapter is registered (e.g. during SSR or first render).
 * Calls proceed without an Authorization header — server returns 401 as expected.
 */
let _service: ITokenService = {
  getToken: async () => null,
};

export function registerTokenService(service: ITokenService): void {
  _service = service;
}

export function getTokenService(): ITokenService {
  return _service;
}

/**
 * Drop-in replacement for fetch() that automatically adds
 * `Authorization: Bearer <token>` when the user is authenticated.
 *
 * IMPORTANT: `init.headers` must be a plain object (Record<string, string>).
 * Passing a `Headers` instance is not supported. All usages in this codebase
 * use plain objects, so this is never an issue in practice.
 *
 * Content-Type is NOT added automatically — callers must include it
 * for POST/PATCH requests:
 *   await authorizedFetch('/api/foo', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify(payload),
 *   });
 */
export async function authorizedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await _service.getToken();
  return fetch(input, {
    ...init,
    headers: {
      ...(init?.headers as Record<string, string> | undefined),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
