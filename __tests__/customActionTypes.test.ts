// Action type registry with admin-defined custom types and toggleable defaults.
//
// Rules:
// - The 5 built-in types (received, cooked, opened, defrosted, cooling) cannot
//   be deleted, only disabled. Disabled = hidden from the picker but still
//   resolvable for display of existing products.
// - Custom types are admin-added. They use the generic Tag icon and a derived
//   shortLabel (first 3 chars + "."). They CAN be soft-deleted, but only when
//   no product references them — that's a store-level invariant.
// - getActionTypeDef must always return *something* sensible, even for
//   disabled/deleted/unknown ids — labels in history reports need to render.

import {
  ACTION_TYPES,
  deriveShortLabel,
  getAvailableActionTypes,
  getActionTypeDef,
} from '../src/lib/actionTypes';

describe('deriveShortLabel', () => {
  it('takes the first 3 chars + "."', () => {
    expect(deriveShortLabel('Mariné')).toBe('Mar.');
  });

  it('capitalises the first letter and lowercases the rest', () => {
    expect(deriveShortLabel('SALÉ')).toBe('Sal.');
  });

  it('handles short strings (under 3 chars)', () => {
    expect(deriveShortLabel('OK')).toBe('Ok.');
    expect(deriveShortLabel('A')).toBe('A.');
  });

  it('trims whitespace before deriving', () => {
    expect(deriveShortLabel('  poulet  ')).toBe('Pou.');
  });

  it('returns "—" for empty input rather than just "."', () => {
    expect(deriveShortLabel('')).toBe('—');
    expect(deriveShortLabel('   ')).toBe('—');
  });
});

describe('getAvailableActionTypes', () => {
  it('returns all 5 defaults when no overrides and no customs', () => {
    const result = getAvailableActionTypes({ customActionTypes: [], defaultActionTypeStates: [] });
    expect(result).toHaveLength(ACTION_TYPES.length);
    expect(result.map((t) => t.id)).toEqual(ACTION_TYPES.map((t) => t.id));
  });

  it('filters out defaults that are marked disabled', () => {
    const result = getAvailableActionTypes({
      customActionTypes: [],
      defaultActionTypeStates: [{ id: 'received', disabled: true, modifiedAt: 1 }],
    });
    expect(result.map((t) => t.id)).not.toContain('received');
    expect(result).toHaveLength(ACTION_TYPES.length - 1);
  });

  it('keeps defaults that are explicitly re-enabled', () => {
    const result = getAvailableActionTypes({
      customActionTypes: [],
      defaultActionTypeStates: [{ id: 'received', disabled: false, modifiedAt: 1 }],
    });
    expect(result.map((t) => t.id)).toContain('received');
  });

  it('appends active customs to the list', () => {
    const result = getAvailableActionTypes({
      customActionTypes: [
        { id: 'c1', label: 'Mariné', dlcDays: 4, modifiedAt: 1 },
      ],
      defaultActionTypeStates: [],
    });
    expect(result.map((t) => t.id)).toContain('c1');
    const c1 = result.find((t) => t.id === 'c1')!;
    expect(c1.label).toBe('Mariné');
    expect(c1.shortLabel).toBe('Mar.');
    expect(c1.dlcDays).toBe(4);
  });

  it('hides tombstoned customs (deletedAt set)', () => {
    const result = getAvailableActionTypes({
      customActionTypes: [
        { id: 'c1', label: 'Mariné', dlcDays: 4, modifiedAt: 1, deletedAt: 2 },
      ],
      defaultActionTypeStates: [],
    });
    expect(result.map((t) => t.id)).not.toContain('c1');
  });
});

describe('getActionTypeDef', () => {
  const state = {
    customActionTypes: [
      { id: 'c1', label: 'Mariné', dlcDays: 4, modifiedAt: 1 },
      { id: 'c2', label: 'Saumuré', dlcDays: 5, modifiedAt: 1, deletedAt: 2 },
    ],
    defaultActionTypeStates: [{ id: 'received' as const, disabled: true, modifiedAt: 1 }],
  };

  it('resolves a built-in id even when disabled (history rendering)', () => {
    const def = getActionTypeDef('received', state);
    expect(def.id).toBe('received');
    expect(def.label).toBe('Reçu');
  });

  it('resolves a custom id', () => {
    const def = getActionTypeDef('c1', state);
    expect(def.id).toBe('c1');
    expect(def.label).toBe('Mariné');
  });

  it('resolves a tombstoned custom id (history rendering)', () => {
    const def = getActionTypeDef('c2', state);
    expect(def.id).toBe('c2');
    expect(def.label).toBe('Saumuré');
  });

  it('falls back to a placeholder for unknown ids', () => {
    const def = getActionTypeDef('unknown-xyz', state);
    expect(def.label.length).toBeGreaterThan(0);
    expect(def.shortLabel.length).toBeGreaterThan(0);
  });
});
