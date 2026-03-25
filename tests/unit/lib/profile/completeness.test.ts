import { describe, it, expect } from 'vitest';
import { getProfileCompleteness, FIELD_LABELS, buildMissingFieldsSentence } from '@/lib/profile/completeness';

describe('getProfileCompleteness', () => {
  it('returns score 28 when only playername and email are set', () => {
    const result = getProfileCompleteness({ playername: 'Jasper', email: 'j@j.nl' } as any);
    expect(result.score).toBe(28); // floor(2/7*100)
    expect(result.missingFields).toEqual(['firstName', 'lastName', 'avatarUrl', 'dateOfBirth', 'preferredLanguage']);
  });

  it('returns score 100 when all fields are set', () => {
    const result = getProfileCompleteness({
      playername: 'Jasper', email: 'j@j.nl',
      firstName: 'Jasper', lastName: 'Huting',
      avatarUrl: 'https://cdn.example.com/a.jpg',
      dateOfBirth: '1990-01-01',
      preferredLanguage: 'nl',
    } as any);
    expect(result.score).toBe(100);
    expect(result.missingFields).toEqual([]);
  });

  it('treats empty string as missing', () => {
    const result = getProfileCompleteness({ playername: 'Jasper', email: 'j@j.nl', firstName: '' } as any);
    expect(result.missingFields).toContain('firstName');
  });

  it('never includes playername or email in missingFields', () => {
    const result = getProfileCompleteness({ playername: '', email: '' } as any);
    expect(result.missingFields).not.toContain('playername');
    expect(result.missingFields).not.toContain('email');
  });
});

describe('FIELD_LABELS', () => {
  it('has a label for every optional field', () => {
    const optionalFields = ['firstName', 'lastName', 'avatarUrl', 'dateOfBirth', 'preferredLanguage'];
    for (const field of optionalFields) {
      expect(FIELD_LABELS[field as keyof typeof FIELD_LABELS]).toBeTruthy();
    }
  });
});

describe('buildMissingFieldsSentence', () => {
  it('returns empty string for 0 missing fields', () => {
    expect(buildMissingFieldsSentence([])).toBe('');
  });

  it('formats correctly for 1 missing field', () => {
    expect(buildMissingFieldsSentence(['avatarUrl'])).toBe(
      'Voeg een **Avatar** toe om je profiel compleet te maken.'
    );
  });

  it('formats correctly for 2 missing fields', () => {
    expect(buildMissingFieldsSentence(['avatarUrl', 'dateOfBirth'])).toBe(
      'Voeg een **Avatar** en **Geboortedatum** toe om je profiel compleet te maken.'
    );
  });

  it('formats correctly for 3+ missing fields', () => {
    expect(buildMissingFieldsSentence(['firstName', 'lastName', 'avatarUrl'])).toBe(
      'Voeg **Voornaam**, **Achternaam** en **Avatar** toe om je profiel compleet te maken.'
    );
  });

  it('filters out fields not in FIELD_LABELS', () => {
    // When mixed valid and invalid fields are passed, only valid ones are used
    expect(buildMissingFieldsSentence(['playername' as any, 'firstName'])).toBe(
      'Voeg een **Voornaam** toe om je profiel compleet te maken.'
    );
  });
});
