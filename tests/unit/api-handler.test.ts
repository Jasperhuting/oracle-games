import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock requireAdmin — adminHandler calls it internally
vi.mock('@/lib/auth/requireAdmin', () => ({
  requireAdmin: vi.fn(),
  AdminAuthorizationError: class AdminAuthorizationError extends Error {
    constructor(message: string, public status: number, public code: string) {
      super(message);
    }
  },
}));

// Mock getServerAuth — userHandler calls it
vi.mock('@/lib/firebase/server', () => ({
  getServerAuth: () => ({
    verifyIdToken: vi.fn().mockRejectedValue(new Error('invalid token')),
    verifySessionCookie: vi.fn().mockRejectedValue(new Error('invalid cookie')),
  }),
}));

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { ApiError, publicHandler, userHandler, adminHandler } from '@/lib/api/handler';

function makeRequest(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('ApiError', () => {
  it('stores message, status, and code', () => {
    const err = new ApiError('Not found', 404, 'not_found');
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
    expect(err.code).toBe('not_found');
  });

  it('works without code', () => {
    const err = new ApiError('Bad request', 400);
    expect(err.status).toBe(400);
    expect(err.code).toBeUndefined();
  });

  it('is an instance of Error', () => {
    expect(new ApiError('x', 500)).toBeInstanceOf(Error);
  });
});

describe('publicHandler', () => {
  it('returns JSON result from fn', async () => {
    const handler = publicHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('converts ApiError to correct HTTP status', async () => {
    const handler = publicHandler('test', async () => {
      throw new ApiError('Missing param', 400, 'bad_input');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Missing param');
    expect(json.code).toBe('bad_input');
  });

  it('converts unknown errors to 500', async () => {
    const handler = publicHandler('test', async () => {
      throw new Error('db exploded');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
    expect((await res.json()).code).toBe('internal_error');
  });
});

describe('userHandler', () => {
  it('returns 401 when no auth provided', async () => {
    const handler = userHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });
});

describe('adminHandler', () => {
  it('returns result when requireAdmin resolves', async () => {
    const { requireAdmin } = await import('@/lib/auth/requireAdmin');
    vi.mocked(requireAdmin).mockResolvedValueOnce({
      uid: 'admin-uid',
      adminProfile: { userId: 'admin-uid', userType: 'admin', isEnabled: true } as any,
    } as any);
    const handler = adminHandler('test', async ({ uid }) => ({ uid }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ uid: 'admin-uid' });
  });

  it('converts AdminAuthorizationError to correct HTTP status', async () => {
    const { requireAdmin, AdminAuthorizationError } = await import('@/lib/auth/requireAdmin');
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new AdminAuthorizationError('Forbidden', 403, 'not_admin'),
    );
    const handler = adminHandler('test', async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toBe('Forbidden');
    expect(json.code).toBe('not_admin');
  });
});
