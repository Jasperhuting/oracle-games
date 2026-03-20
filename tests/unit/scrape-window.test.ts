import { describe, expect, it } from 'vitest';
import { formatDateOnlyInAmsterdam, getCompletedRaceDates } from '@/lib/utils/scrape-window';

describe('getCompletedRaceDates', () => {
  it('excludes the current Amsterdam calendar day from the scrape window', () => {
    const runDate = new Date('2026-03-18T00:15:00+01:00');

    expect(formatDateOnlyInAmsterdam(runDate)).toBe('2026-03-18');
    expect(getCompletedRaceDates(runDate, 3)).toEqual([
      '2026-03-17',
      '2026-03-16',
      '2026-03-15',
    ]);
  });

  it('uses Amsterdam local date around UTC boundaries', () => {
    const runDate = new Date('2026-03-17T23:30:00Z');

    expect(formatDateOnlyInAmsterdam(runDate)).toBe('2026-03-18');
    expect(getCompletedRaceDates(runDate, 2)).toEqual([
      '2026-03-17',
      '2026-03-16',
    ]);
  });
});
