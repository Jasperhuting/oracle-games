import { describe, it, expect } from 'vitest';
import { isProTourTeamClass, normalizeTeamKey } from '@/lib/bidding/teamUtils';

describe('isProTourTeamClass', () => {
  it('returns true for "prt"', () => {
    expect(isProTourTeamClass('prt')).toBe(true);
  });
  it('returns true for "ProTeam" (case-insensitive)', () => {
    expect(isProTourTeamClass('ProTeam')).toBe(true);
  });
  it('returns true for "pro team" with space', () => {
    expect(isProTourTeamClass('pro team')).toBe(true);
  });
  it('returns true for "protour"', () => {
    expect(isProTourTeamClass('protour')).toBe(true);
  });
  it('returns true for "pro tour"', () => {
    expect(isProTourTeamClass('pro tour')).toBe(true);
  });
  it('returns true for "pro"', () => {
    expect(isProTourTeamClass('pro')).toBe(true);
  });
  it('returns false for "PCT" (continental team)', () => {
    expect(isProTourTeamClass('PCT')).toBe(false);
  });
  it('returns false for undefined', () => {
    expect(isProTourTeamClass(undefined)).toBe(false);
  });
  it('returns false for empty string', () => {
    expect(isProTourTeamClass('')).toBe(false);
  });
  it('trims leading/trailing whitespace', () => {
    expect(isProTourTeamClass('  prt  ')).toBe(true);
  });
});

describe('normalizeTeamKey', () => {
  it('strips spaces, pipes, and dashes', () => {
    expect(normalizeTeamKey('Team Visma | Lease a Bike')).toBe('teamvismaleaseabike');
  });
  it('lowercases the result', () => {
    expect(normalizeTeamKey('UAE Team Emirates')).toBe('uaeteamemirates');
  });
  it('handles undefined', () => {
    expect(normalizeTeamKey(undefined)).toBe('');
  });
  it('handles empty string', () => {
    expect(normalizeTeamKey('')).toBe('');
  });
  it('preserves digits', () => {
    expect(normalizeTeamKey('Team 2000')).toBe('team2000');
  });
});
