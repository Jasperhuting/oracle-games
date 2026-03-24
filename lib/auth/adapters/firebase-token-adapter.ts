'use client';

import { auth } from '@/lib/firebase/client';
import type { ITokenService } from '@/lib/auth/token-service.port';

/**
 * Reads tokens from Firebase Auth. This is the only file in the codebase
 * that imports auth from @/lib/firebase/client for token purposes.
 *
 * Works correctly during impersonation: signInWithCustomToken() sets
 * auth.currentUser to the impersonated user, so getIdToken() returns
 * the impersonated user's ID token automatically.
 */
export class FirebaseTokenAdapter implements ITokenService {
  async getToken(options?: { forceRefresh?: boolean }): Promise<string | null> {
    return (await auth.currentUser?.getIdToken(options?.forceRefresh)) ?? null;
  }
}
