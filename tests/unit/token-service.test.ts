import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerTokenService, getTokenService, authorizedFetch } from '@/lib/auth/token-service';
import { MockTokenAdapter } from '@/lib/auth/adapters/mock-token-adapter';

// Mock global fetch for all tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('token-service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerTokenService(new MockTokenAdapter('test-token'));
  });

  it('MockTokenAdapter returns preset token', async () => {
    const adapter = new MockTokenAdapter('abc');
    expect(await adapter.getToken()).toBe('abc');
  });

  it('MockTokenAdapter returns null when initialized with null', async () => {
    const adapter = new MockTokenAdapter(null);
    expect(await adapter.getToken()).toBeNull();
  });

  it('getTokenService returns the registered service', async () => {
    const token = await getTokenService().getToken();
    expect(token).toBe('test-token');
  });

  it('authorizedFetch adds Authorization header when token is present', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test');
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('authorizedFetch does not add Authorization header when token is null', async () => {
    registerTokenService(new MockTokenAdapter(null));
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/public');
    const headers = mockFetch.mock.calls[0][1]?.headers ?? {};
    expect(headers['Authorization']).toBeUndefined();
  });

  it('authorizedFetch forwards init options to fetch', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
  });

  it('authorizedFetch merges caller headers with Authorization', async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await authorizedFetch('/api/test', {
      headers: { 'Content-Type': 'application/json' },
    });
    const headers = mockFetch.mock.calls[0][1]?.headers ?? {};
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['Authorization']).toBe('Bearer test-token');
  });
});
