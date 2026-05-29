// Back-dating "Utilisé" on expired tickets.
//
// Audit story: the user forgot to mark a product as used when they actually
// used it; the DLC has since passed. We let them mark it as used after the
// fact, but the chosen date must lie inside the product's valid window:
//   addedAt  <=  usedAt  <  dlc          (strictly before DLC — the user said "inférieur")
//   usedAt   <=  now                     (can't claim usage in the future)
//
// Returns French error messages; empty array == OK.

import { validateUsedAt } from '../src/lib/usedAt';

const DAY = 24 * 60 * 60 * 1000;

describe('validateUsedAt', () => {
  const addedAt = 1_700_000_000_000;
  const dlc = addedAt + 3 * DAY;
  const now = dlc + 2 * DAY; // product is 2 days expired

  it('passes when usedAt is strictly before dlc and after addedAt', () => {
    expect(validateUsedAt({ usedAt: addedAt + 1 * DAY, dlc, addedAt, now })).toEqual([]);
  });

  it('passes when usedAt equals addedAt (same instant)', () => {
    expect(validateUsedAt({ usedAt: addedAt, dlc, addedAt, now })).toEqual([]);
  });

  it('blocks when usedAt equals dlc exactly (must be strictly before)', () => {
    const errors = validateUsedAt({ usedAt: dlc, dlc, addedAt, now });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /avant.*DLC|p[ée]remption|expiration/i.test(e))).toBe(true);
  });

  it('blocks when usedAt is after dlc', () => {
    const errors = validateUsedAt({ usedAt: dlc + 1, dlc, addedAt, now });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('blocks when usedAt is before addedAt', () => {
    const errors = validateUsedAt({ usedAt: addedAt - 1, dlc, addedAt, now });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /ajout|cr[ée]ation/i.test(e))).toBe(true);
  });

  it('blocks when usedAt is in the future', () => {
    const errors = validateUsedAt({ usedAt: now + 1 * DAY, dlc: now + 5 * DAY, addedAt: now - 1 * DAY, now });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /futur/i.test(e))).toBe(true);
  });

  it('blocks when usedAt is missing', () => {
    expect(validateUsedAt({ usedAt: undefined as any, dlc, addedAt, now }).length).toBeGreaterThan(0);
  });

  it('blocks when usedAt is NaN', () => {
    expect(validateUsedAt({ usedAt: NaN, dlc, addedAt, now }).length).toBeGreaterThan(0);
  });
});
