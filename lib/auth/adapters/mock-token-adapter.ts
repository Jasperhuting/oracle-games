import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Test double for ITokenService. Zero Firebase imports.
 *
 * Usage in tests:
 *   beforeEach(() => registerTokenService(new MockTokenAdapter('my-test-token')));
 */
export class MockTokenAdapter implements ITokenService {
  constructor(private readonly token: string | null = 'mock-token') {}

  async getToken(_options?: { forceRefresh?: boolean }): Promise<string | null> {
    return this.token;
  }
}
