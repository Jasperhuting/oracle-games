/**
 * Utility for adding cache version headers to API responses
 * This allows clients to detect cache invalidation without realtime Firestore listeners
 */

import { NextResponse } from 'next/server';
import { getServerFirebase } from '@/lib/firebase/server';

let cachedVersion: { version: number; timestamp: number } | null = null;
const CACHE_TTL = 30000; // Cache version for 30 seconds server-side

/**
 * Get current cache version from Firestore (with server-side caching)
 */
async function getCacheVersion(): Promise<number> {
  const now = Date.now();

  // Return cached version if still fresh
  if (cachedVersion && now - cachedVersion.timestamp < CACHE_TTL) {
    return cachedVersion.version;
  }

  try {
    const db = getServerFirebase();
    const systemRef = db.collection('system').doc('cache');
    const systemDoc = await systemRef.get();

    const version = systemDoc.exists ? (systemDoc.data()?.version || 1) : 1;

    // Cache the version
    cachedVersion = { version, timestamp: now };

    return version;
  } catch (error) {
    console.error('[ApiCacheHeaders] Error fetching cache version:', error);
    // Return cached version if available, otherwise default to 1
    return cachedVersion?.version || 1;
  }
}

/**
 * Add cache version header to a NextResponse
 * Usage: return addCacheVersionHeader(NextResponse.json({ data }))
 */
export async function addCacheVersionHeader<T>(
  response: NextResponse<T>
): Promise<NextResponse<T>> {
  try {
    const version = await getCacheVersion();
    response.headers.set('X-Cache-Version', version.toString());
  } catch (error) {
    console.error('[ApiCacheHeaders] Failed to add cache version header:', error);
  }

  return response;
}

/**
 * Helper to create a NextResponse with cache version header
 * Usage: return jsonWithCacheVersion({ success: true, data })
 */
export async function jsonWithCacheVersion<T>(
  data: T,
  init?: ResponseInit
): Promise<NextResponse<T>> {
  const response = NextResponse.json(data, init);
  return addCacheVersionHeader(response);
}
