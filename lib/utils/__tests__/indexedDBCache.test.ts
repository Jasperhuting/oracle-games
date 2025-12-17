/**
 * Tests for IndexedDB cache utility
 * Note: These tests use fake-indexeddb for testing in Node environment
 */

import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock IndexedDB for testing
import 'fake-indexeddb/auto';

import {
  getFromCache,
  saveToCache,
  removeFromCache,
  clearCache,
  clearOldVersions
} from '../indexedDBCache';

interface TestData {
  id: string;
  value: string;
}

describe('IndexedDB Cache', () => {
  beforeEach(async () => {
    // Clear cache before each test
    await clearCache();
  });

  it('should save and retrieve data', async () => {
    const testData: TestData[] = [
      { id: '1', value: 'test1' },
      { id: '2', value: 'test2' }
    ];

    const success = await saveToCache('test-key', testData, 1);
    expect(success).toBe(true);

    const retrieved = await getFromCache<TestData[]>('test-key', 1);
    expect(retrieved).toEqual(testData);
  });

  it('should return null for non-existent key', async () => {
    const retrieved = await getFromCache('non-existent', 1);
    expect(retrieved).toBeNull();
  });

  it('should return null for version mismatch', async () => {
    const testData = { value: 'test' };

    await saveToCache('test-key', testData, 1);
    const retrieved = await getFromCache('test-key', 2); // Different version

    expect(retrieved).toBeNull();
  });

  it('should remove data', async () => {
    const testData = { value: 'test' };

    await saveToCache('test-key', testData, 1);
    const success = await removeFromCache('test-key');
    expect(success).toBe(true);

    const retrieved = await getFromCache('test-key', 1);
    expect(retrieved).toBeNull();
  });

  it('should clear all data', async () => {
    await saveToCache('key1', { value: 'test1' }, 1);
    await saveToCache('key2', { value: 'test2' }, 1);

    const success = await clearCache();
    expect(success).toBe(true);

    const retrieved1 = await getFromCache('key1', 1);
    const retrieved2 = await getFromCache('key2', 1);

    expect(retrieved1).toBeNull();
    expect(retrieved2).toBeNull();
  });

  it('should clear old versions', async () => {
    await saveToCache('key1', { value: 'v1' }, 1);
    await saveToCache('key2', { value: 'v2' }, 2);
    await saveToCache('key3', { value: 'v3' }, 2);

    await clearOldVersions(2);

    const v1Data = await getFromCache('key1', 1);
    const v2Data1 = await getFromCache('key2', 2);
    const v2Data2 = await getFromCache('key3', 2);

    expect(v1Data).toBeNull(); // Old version cleared
    expect(v2Data1).toEqual({ value: 'v2' }); // Current version kept
    expect(v2Data2).toEqual({ value: 'v3' }); // Current version kept
  });

  it('should handle large data sets', async () => {
    // Create a large dataset (simulating rider rankings)
    const largeData = Array.from({ length: 1000 }, (_, i) => ({
      id: `rider-${i}`,
      name: `Rider ${i}`,
      team: `Team ${i % 20}`,
      points: Math.floor(Math.random() * 10000),
      rank: i + 1
    }));

    const success = await saveToCache('large-test', largeData, 1);
    expect(success).toBe(true);

    const retrieved = await getFromCache('large-test', 1);
    expect(retrieved).toEqual(largeData);
  });
});
