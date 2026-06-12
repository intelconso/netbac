// Réceptions de la journée — one record per delivery: supplier, BL/invoice
// reference, reception check result with corrective action on non-conform.
// Same sync semantics as the other register controls.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const baseReception = {
  supplier: 'Metro',
  result: 'conforme' as const,
};

describe('reception CRUD', () => {
  it('records a conform delivery with stamps', () => {
    useStore.getState().addReception({ ...baseReception, reference: 'BL-1234' });
    const [r] = useStore.getState().receptions;
    expect(r.supplier).toBe('Metro');
    expect(r.reference).toBe('BL-1234');
    expect(r.recordedAt).toBe(r.timestamp);
  });

  it('records a non-conform delivery with its corrective action', () => {
    useStore.getState().addReception({ ...baseReception, result: 'non_conforme', correctiveAction: 'Lot refusé, retour fournisseur' });
    const [r] = useStore.getState().receptions;
    expect(r.result).toBe('non_conforme');
    expect(r.correctiveAction).toBe('Lot refusé, retour fournisseur');
  });

  it('edits in place, preserving timestamp and recordedAt', () => {
    useStore.getState().addReception(baseReception);
    const before = useStore.getState().receptions[0];
    useStore.getState().updateReception(before.id, { reference: 'F-987' });
    const after = useStore.getState().receptions[0];
    expect(after.reference).toBe('F-987');
    expect(after.timestamp).toBe(before.timestamp);
    expect(after.recordedAt).toBe(before.recordedAt);
  });

  it('soft-deletes with a tombstone', () => {
    useStore.getState().addReception(baseReception);
    const id = useStore.getState().receptions[0].id;
    useStore.getState().deleteReception(id);
    expect(useStore.getState().receptions[0].deletedAt).toBeGreaterThan(0);
    expect(useStore.getState().receptions).toHaveLength(1);
  });
});

describe('cloud merge', () => {
  it('merges with newer-modifiedAt-wins like the other controls', () => {
    useStore.getState().addReception(baseReception);
    const local = useStore.getState().receptions[0];
    const remote = { ...baseReception, id: 'remote1', timestamp: 100, modifiedAt: 100 };
    const stale = { ...local, supplier: 'périmé', modifiedAt: local.modifiedAt - 1000 };
    useStore.getState().applyCloudState({ receptions: [remote, stale] } as any);
    const recs = useStore.getState().receptions;
    expect(recs.map((x) => x.id)).toContain('remote1');
    expect(recs.find((x) => x.id === local.id)?.supplier).toBe('Metro');
  });
});
