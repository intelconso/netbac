import { findDuplicateProduct as findDuplicate } from '../src/lib/utils';

type ProductLite = { id: string; bacId: string; name: string; status: 'active' | 'used' | 'discarded' };

const sample: ProductLite[] = [
  { id: '1', bacId: 'bac-A', name: 'Poulet rôti', status: 'active' },
  { id: '2', bacId: 'bac-A', name: 'Sauce', status: 'active' },
  { id: '3', bacId: 'bac-B', name: 'Poulet rôti', status: 'active' },
  { id: '4', bacId: 'bac-A', name: 'Poulet rôti', status: 'used' },
];

describe('findDuplicate (option B: bac + name)', () => {
  it('flags exact match on same bac', () => {
    expect(findDuplicate(sample, 'bac-A', 'Poulet rôti')?.id).toBe('1');
  });

  it('is case-insensitive', () => {
    expect(findDuplicate(sample, 'bac-A', 'poulet RÔTI')?.id).toBe('1');
  });

  it('ignores leading/trailing whitespace', () => {
    expect(findDuplicate(sample, 'bac-A', '  Poulet rôti  ')?.id).toBe('1');
  });

  it('does NOT flag same name in different bac', () => {
    // bac-B has Poulet rôti (id 3), but we're checking bac-A → should match id 1
    expect(findDuplicate(sample, 'bac-A', 'Poulet rôti')?.id).toBe('1');
    expect(findDuplicate([sample[2]], 'bac-A', 'Poulet rôti')).toBeUndefined();
  });

  it('does NOT flag different name in same bac', () => {
    expect(findDuplicate(sample, 'bac-A', 'Poulet aux herbes')).toBeUndefined();
  });

  it('does NOT flag a used/discarded product', () => {
    // id 4 is used; nothing else matches → no duplicate
    expect(findDuplicate([sample[3]], 'bac-A', 'Poulet rôti')).toBeUndefined();
  });

  it('excludes the product currently being edited', () => {
    expect(findDuplicate(sample, 'bac-A', 'Poulet rôti', '1')).toBeUndefined();
  });

  it('still flags a different active product when editing', () => {
    const extra: ProductLite[] = [
      ...sample,
      { id: '99', bacId: 'bac-A', name: 'Poulet rôti', status: 'active' },
    ];
    // editing id=1; id=99 is a separate dupe
    expect(findDuplicate(extra, 'bac-A', 'Poulet rôti', '1')?.id).toBe('99');
  });
});
