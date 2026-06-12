// Contrôle des huiles de friture — one global daily check.
//
// Rules:
// - addOilCheck stamps id/timestamp/modifiedAt; result is conforme or
//   non_conforme, oilChanged records that the oil was replaced (pickup by an
//   approved organization is noted in `notes`).
// - Deletion is a tombstone (deletedAt) so the sync union-merge can propagate
//   it across devices.
// - applyCloudState merges oilChecks with newer-modifiedAt-wins, same as the
//   other entity arrays.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

const baseCheck = {
  result: 'conforme' as const,
  oilChanged: false,
  operatorId: 'op1',
  operatorName: 'Fares',
};

describe('oil check CRUD', () => {
  it('adds a check with id, timestamp and modifiedAt stamped', () => {
    useStore.getState().addOilCheck(baseCheck);
    const [check] = useStore.getState().oilChecks;
    expect(check.id).toBeTruthy();
    expect(check.timestamp).toBeGreaterThan(0);
    expect(check.modifiedAt).toBe(check.timestamp);
    expect(check.result).toBe('conforme');
  });

  it('records non-conform result and oil change', () => {
    useStore.getState().addOilCheck({ ...baseCheck, result: 'non_conforme', oilChanged: true, notes: 'huile noire' });
    const [check] = useStore.getState().oilChecks;
    expect(check.result).toBe('non_conforme');
    expect(check.oilChanged).toBe(true);
    expect(check.notes).toBe('huile noire');
  });

  it('edits a check in place, preserving its timestamp and bumping modifiedAt', () => {
    useStore.getState().addOilCheck(baseCheck);
    const before = useStore.getState().oilChecks[0];
    useStore.getState().updateOilCheck(before.id, { result: 'non_conforme', notes: 'corrigé' });
    const after = useStore.getState().oilChecks[0];
    expect(after.result).toBe('non_conforme');
    expect(after.notes).toBe('corrigé');
    expect(after.timestamp).toBe(before.timestamp);
    expect(after.modifiedAt).toBeGreaterThanOrEqual(before.modifiedAt);
    expect(useStore.getState().oilChecks).toHaveLength(1);
  });

  it('backfills a missed day: timestamp on that day, modifiedAt now, flagged', () => {
    const yesterdayNoon = Date.now() - 86400000;
    useStore.getState().addOilCheck({ ...baseCheck, backfilled: true }, { timestamp: yesterdayNoon });
    const [check] = useStore.getState().oilChecks;
    expect(check.timestamp).toBe(yesterdayNoon);
    expect(check.modifiedAt).toBeGreaterThan(yesterdayNoon);
    expect(check.backfilled).toBe(true);
    // The real entry moment is kept separately and survives later edits.
    expect(check.recordedAt).toBeGreaterThan(yesterdayNoon);
    useStore.getState().updateOilCheck(check.id, { result: 'non_conforme' });
    expect(useStore.getState().oilChecks[0].recordedAt).toBe(check.recordedAt);
  });

  it('soft-deletes with a tombstone instead of removing', () => {
    useStore.getState().addOilCheck(baseCheck);
    const id = useStore.getState().oilChecks[0].id;
    useStore.getState().deleteOilCheck(id);
    const [check] = useStore.getState().oilChecks;
    expect(check.deletedAt).toBeGreaterThan(0);
    expect(useStore.getState().oilChecks).toHaveLength(1);
  });
});

describe('cloud merge', () => {
  it('adds cloud-only checks to local state', () => {
    const remote = { ...baseCheck, id: 'remote1', timestamp: 100, modifiedAt: 100 };
    useStore.getState().applyCloudState({ oilChecks: [remote] } as any);
    expect(useStore.getState().oilChecks.map((c) => c.id)).toContain('remote1');
  });

  it('keeps the newer version when both sides have the same check', () => {
    useStore.getState().addOilCheck(baseCheck);
    const local = useStore.getState().oilChecks[0];
    const newerTombstone = { ...local, deletedAt: local.modifiedAt + 1, modifiedAt: local.modifiedAt + 1 };
    useStore.getState().applyCloudState({ oilChecks: [newerTombstone] } as any);
    expect(useStore.getState().oilChecks[0].deletedAt).toBe(newerTombstone.deletedAt);
  });

  it('does not let an older cloud copy overwrite a newer local one', () => {
    useStore.getState().addOilCheck(baseCheck);
    const local = useStore.getState().oilChecks[0];
    const stale = { ...local, result: 'non_conforme' as const, modifiedAt: local.modifiedAt - 1000 };
    useStore.getState().applyCloudState({ oilChecks: [stale] } as any);
    expect(useStore.getState().oilChecks[0].result).toBe('conforme');
  });
});
