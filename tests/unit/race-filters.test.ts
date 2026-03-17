import { describe, it, expect } from 'vitest';
import { shouldExcludeRace } from '@/lib/utils/race-filters';

describe('shouldExcludeRace', () => {
  describe('explicit excludeFromScraping flag', () => {
    it('returns true when excludeFromScraping is true', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france', true)).toBe(true);
    });

    it('returns false for normal race when flag is false', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france', false)).toBe(false);
    });
  });

  describe('classification-based exclusion', () => {
    it('returns true for WWT classification (Women WorldTour)', () => {
      expect(shouldExcludeRace('Tour Femmes', '2.WWT', 'tour-femmes')).toBe(true);
    });

    it('returns true for WE classification (Women Elite)', () => {
      expect(shouldExcludeRace('Some Race', '1.WE', 'some-race')).toBe(true);
    });

    it('returns true for MU classification (Men Under-23)', () => {
      expect(shouldExcludeRace('Giro U23', '2.MU', 'giro-u23')).toBe(true);
    });

    it('returns true for MJ classification (Men Junior)', () => {
      expect(shouldExcludeRace('Race MJ', '1.MJ', 'race-mj')).toBe(true);
    });

    it('returns true for WU classification (Women Under-23)', () => {
      expect(shouldExcludeRace('Race WU', '1.WU', 'race-wu')).toBe(true);
    });

    it('returns true for WJ classification (Women Junior)', () => {
      expect(shouldExcludeRace('Race WJ', '1.WJ', 'race-wj')).toBe(true);
    });

    it('returns false for normal 2.UWT race', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT', 'tour-de-france')).toBe(false);
    });

    it('returns false for 1.Pro race', () => {
      expect(shouldExcludeRace('Paris-Tours', '1.Pro', 'paris-tours')).toBe(false);
    });

    it('handles null classification', () => {
      expect(shouldExcludeRace('Tour de France', null, 'tour-de-france')).toBe(false);
    });
  });

  describe('name-based exclusion (women keywords)', () => {
    it('returns true for WOMEN in name', () => {
      expect(shouldExcludeRace('Tour of Women', '2.1', 'tour-of-women')).toBe(true);
    });

    it('returns true for DAMES in name', () => {
      expect(shouldExcludeRace('Omloop der Dames', '1.1', 'omloop-der-dames')).toBe(true);
    });

    it('returns true for LADIES in name', () => {
      expect(shouldExcludeRace('Ladies Tour', '2.1', 'ladies-tour')).toBe(true);
    });

    it('returns true for FEMMES in name', () => {
      expect(shouldExcludeRace('Tour des Femmes', '2.Pro', 'tour-des-femmes')).toBe(true);
    });

    it('returns true for women keyword in slug', () => {
      expect(shouldExcludeRace('Some Race', '1.1', 'some-race-women')).toBe(true);
    });
  });

  describe('word boundary matching for classification codes in name', () => {
    it('does not match MU inside a longer word (AMU)', () => {
      // "AMUNDSEN" contains "MU" but should not be flagged
      expect(shouldExcludeRace('Grand Prix Amundsen', '1.1', 'gp-amundsen')).toBe(false);
    });

    it('matches MU as standalone token in name (neutral classification)', () => {
      // Use a neutral classification to isolate the word-boundary name check
      expect(shouldExcludeRace('Giro MU 2025', '2.1', 'giro-mu-2025')).toBe(true);
    });
  });

  describe('optional arguments', () => {
    it('works without slug argument', () => {
      expect(shouldExcludeRace('Tour de France', '2.UWT')).toBe(false);
    });

    it('works without slug and excludeFromScraping arguments', () => {
      expect(shouldExcludeRace('Tour Femmes', '2.WWT')).toBe(true);
    });
  });
});
