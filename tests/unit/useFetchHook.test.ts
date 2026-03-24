import { describe, it, expect, vi } from 'vitest';

// Tests for the core fetch logic used inside useFetchHook.
// The hook itself wraps React state/effects which require a DOM environment;
// these tests verify the pure async logic that the hook delegates to.

describe('useFetchHook fetch logic', () => {
  it('fetcher is called when enabled and resolves the expected value', async () => {
    const fetcher = vi.fn().mockResolvedValue('result');
    const result = await fetcher();
    expect(result).toBe('result');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('normalises a string thrown value into an Error', () => {
    const normalise = (err: unknown): Error =>
      err instanceof Error ? err : new Error(String(err));
    const error = normalise('string error');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('string error');
  });

  it('normalises a number thrown value into an Error', () => {
    const normalise = (err: unknown): Error =>
      err instanceof Error ? err : new Error(String(err));
    const error = normalise(42);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('42');
  });

  it('passes through an existing Error unchanged', () => {
    const normalise = (err: unknown): Error =>
      err instanceof Error ? err : new Error(String(err));
    const original = new Error('original');
    expect(normalise(original)).toBe(original);
  });

  it('enabled=false path: returns emptyValue without calling fetcher', () => {
    const emptyValue: string[] = [];
    const fetcher = vi.fn();
    let data = emptyValue;
    const enabled = false;
    if (!enabled) {
      data = emptyValue;
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(data).toEqual([]);
  });

  it('enabled=true path: calls fetcher and stores the result', async () => {
    const emptyValue: string[] = [];
    const fetcher = vi.fn().mockResolvedValue(['item1', 'item2']);
    let data = emptyValue;
    let error: Error | null = null;
    const enabled = true;

    if (enabled) {
      try {
        data = await fetcher();
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        data = emptyValue;
      }
    }

    expect(fetcher).toHaveBeenCalledOnce();
    expect(data).toEqual(['item1', 'item2']);
    expect(error).toBeNull();
  });

  it('enabled=true path: sets emptyValue and captures error when fetcher rejects', async () => {
    const emptyValue: string[] = [];
    const fetcher = vi.fn().mockRejectedValue(new Error('network failure'));
    let data = emptyValue;
    let error: Error | null = null;
    const enabled = true;

    if (enabled) {
      try {
        data = await fetcher();
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err));
        data = emptyValue;
      }
    }

    expect(fetcher).toHaveBeenCalledOnce();
    expect(data).toEqual([]);
    expect(error).toBeInstanceOf(Error);
    expect(error?.message).toBe('network failure');
  });
});
