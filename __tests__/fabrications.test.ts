// Fabrication(s) du jour — one record per preparation, traceability of the
// lot used, optional low-temperature cooking and cooling/reheat temps, and
// at least one storage/distribution destination. Same sync semantics as the
// other register controls (tombstones, newer-modifiedAt merge, recordedAt).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const baseFab = {
  name: 'Lasagnes maison',
  lotUsage: 'entier' as const,
  destinations: ['froid_positif' as const],
};

describe('fabrication CRUD', () => {
  it('adds a fabrication with id, timestamp and recordedAt stamped', () => {
    useStore.getState().addFabrication(baseFab);
    const [fab] = useStore.getState().fabrications;
    expect(fab.id).toBeTruthy();
    expect(fab.timestamp).toBeGreaterThan(0);
    expect(fab.recordedAt).toBe(fab.timestamp);
    expect(fab.name).toBe('Lasagnes maison');
  });

  it('stores optional cooking and cooling fields', () => {
    useStore.getState().addFabrication({
      ...baseFab,
      ingredients: 'Bœuf, tomates',
      cookingTime: '3h30',
      cookingTemp: 82,
      coolingTempStart: 63,
      coolingTempEnd: 8,
      destinations: ['congelateur', 'servi'],
    });
    const [fab] = useStore.getState().fabrications;
    expect(fab.cookingTemp).toBe(82);
    expect(fab.coolingTempEnd).toBe(8);
    expect(fab.destinations).toEqual(['congelateur', 'servi']);
  });

  it('edits in place, preserving timestamp and recordedAt', () => {
    useStore.getState().addFabrication(baseFab);
    const before = useStore.getState().fabrications[0];
    useStore.getState().updateFabrication(before.id, { name: 'Lasagnes v2' });
    const after = useStore.getState().fabrications[0];
    expect(after.name).toBe('Lasagnes v2');
    expect(after.timestamp).toBe(before.timestamp);
    expect(after.recordedAt).toBe(before.recordedAt);
  });

  it('soft-deletes with a tombstone', () => {
    useStore.getState().addFabrication(baseFab);
    const id = useStore.getState().fabrications[0].id;
    useStore.getState().deleteFabrication(id);
    expect(useStore.getState().fabrications[0].deletedAt).toBeGreaterThan(0);
    expect(useStore.getState().fabrications).toHaveLength(1);
  });
});

describe('fabrication types (schema-driven forms)', () => {
  it('creates a type with its field schema', () => {
    const id = useStore.getState().addFabricationType({
      label: 'Sauce mère',
      fields: [
        { id: 'f1', label: 'Base', kind: 'choice', required: true, options: ['Tomate', 'Béchamel'] },
        { id: 'f2', label: 'T°C fin de cuisson', kind: 'number', unit: '°C' },
      ],
    });
    const t = useStore.getState().fabricationTypes.find((x) => x.id === id);
    expect(t?.label).toBe('Sauce mère');
    expect(t?.fields).toHaveLength(2);
    expect(t?.fields[0].options).toEqual(['Tomate', 'Béchamel']);
  });

  it('tombstones a type without touching existing records', () => {
    const id = useStore.getState().addFabricationType({ label: 'Temp', fields: [{ id: 'f1', label: 'Note', kind: 'text' }] });
    useStore.getState().addFabrication({
      name: 'Essai',
      typeId: id,
      typeLabel: 'Temp',
      values: [{ fieldId: 'f1', label: 'Note', value: 'ok' }],
    });
    useStore.getState().removeFabricationType(id);
    expect(useStore.getState().fabricationTypes.find((x) => x.id === id)?.deletedAt).toBeGreaterThan(0);
    // Record still renders from its own snapshot
    const fab = useStore.getState().fabrications[0];
    expect(fab.typeLabel).toBe('Temp');
    expect(fab.values?.[0]).toEqual({ fieldId: 'f1', label: 'Note', value: 'ok' });
  });

  it('updates a type schema in place', () => {
    const id = useStore.getState().addFabricationType({ label: 'X', fields: [{ id: 'f1', label: 'A', kind: 'text' }] });
    useStore.getState().updateFabricationType(id, { fields: [{ id: 'f1', label: 'A', kind: 'text' }, { id: 'f2', label: 'B', kind: 'toggle' }] });
    expect(useStore.getState().fabricationTypes.find((x) => x.id === id)?.fields).toHaveLength(2);
  });
});

describe('cloud merge', () => {
  it('merges with newer-modifiedAt-wins like the other controls', () => {
    useStore.getState().addFabrication(baseFab);
    const local = useStore.getState().fabrications[0];
    const remote = { ...baseFab, id: 'remote1', timestamp: 100, modifiedAt: 100 };
    const stale = { ...local, name: 'périmé', modifiedAt: local.modifiedAt - 1000 };
    useStore.getState().applyCloudState({ fabrications: [remote, stale] } as any);
    const fabs = useStore.getState().fabrications;
    expect(fabs.map((x) => x.id)).toContain('remote1');
    expect(fabs.find((x) => x.id === local.id)?.name).toBe('Lasagnes maison');
  });
});
