// Relevés des températures des enceintes frigorifiques.
//
// Rules:
// - Conformity is derived from the unit type's regulatory range (arrêté du
//   21/12/2009 annexe 1): frigo/saladette 0..+4°C, congélateur ≤ −18°C;
//   reserve/autre are not cold units.
// - Two readings per day per unit (début / fin de service); each check stores
//   the derived `conform` snapshot and a corrective action when out of range.
// - Same sync semantics as oil checks: tombstone deletes, newer-modifiedAt
//   merge, backfill via options.timestamp.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import { isColdUnit, isTempConform, targetLabel } from '../src/lib/fridgeTemp';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

describe('regulatory ranges', () => {
  it('classifies cold units', () => {
    expect(isColdUnit('frigo')).toBe(true);
    expect(isColdUnit('congelateur')).toBe(true);
    expect(isColdUnit('saladette')).toBe(true);
    expect(isColdUnit('reserve')).toBe(false);
    expect(isColdUnit('autre')).toBe(false);
  });

  it('frigo conform between 0 and +4°C', () => {
    expect(isTempConform('frigo', 0)).toBe(true);
    expect(isTempConform('frigo', 4)).toBe(true);
    expect(isTempConform('frigo', 4.5)).toBe(false);
    expect(isTempConform('frigo', -1)).toBe(false);
  });

  it('congélateur conform at or below −18°C', () => {
    expect(isTempConform('congelateur', -18)).toBe(true);
    expect(isTempConform('congelateur', -22)).toBe(true);
    expect(isTempConform('congelateur', -15)).toBe(false);
  });

  it('labels targets for the UI', () => {
    expect(targetLabel('frigo')).toBe('0 à +4°C');
    expect(targetLabel('congelateur')).toBe('≤ -18°C');
  });
});

const baseCheck = {
  unitId: 'u1',
  service: 'debut' as const,
  temperature: 3,
  conform: true,
  operatorId: 'op1',
  operatorName: 'Fares',
};

describe('fridge temp check CRUD', () => {
  it('adds a reading with id, timestamp and modifiedAt stamped', () => {
    useStore.getState().addFridgeTempCheck(baseCheck);
    const [check] = useStore.getState().fridgeTempChecks;
    expect(check.id).toBeTruthy();
    expect(check.timestamp).toBeGreaterThan(0);
    expect(check.modifiedAt).toBe(check.timestamp);
    expect(check.service).toBe('debut');
  });

  it('stores non-conform readings with their corrective action', () => {
    useStore.getState().addFridgeTempCheck({ ...baseCheck, temperature: 8, conform: false, correctiveAction: 'Technicien appelé' });
    const [check] = useStore.getState().fridgeTempChecks;
    expect(check.conform).toBe(false);
    expect(check.correctiveAction).toBe('Technicien appelé');
  });

  it('edits a reading in place, preserving its timestamp', () => {
    useStore.getState().addFridgeTempCheck(baseCheck);
    const before = useStore.getState().fridgeTempChecks[0];
    useStore.getState().updateFridgeTempCheck(before.id, { temperature: 2 });
    const after = useStore.getState().fridgeTempChecks[0];
    expect(after.temperature).toBe(2);
    expect(after.timestamp).toBe(before.timestamp);
  });

  it('backfills a missed day with the flag and that day timestamp', () => {
    const yesterday = Date.now() - 86400000;
    useStore.getState().addFridgeTempCheck({ ...baseCheck, backfilled: true }, { timestamp: yesterday });
    const [check] = useStore.getState().fridgeTempChecks;
    expect(check.timestamp).toBe(yesterday);
    expect(check.backfilled).toBe(true);
    expect(check.modifiedAt).toBeGreaterThan(yesterday);
  });

  it('soft-deletes with a tombstone', () => {
    useStore.getState().addFridgeTempCheck(baseCheck);
    const id = useStore.getState().fridgeTempChecks[0].id;
    useStore.getState().deleteFridgeTempCheck(id);
    expect(useStore.getState().fridgeTempChecks[0].deletedAt).toBeGreaterThan(0);
    expect(useStore.getState().fridgeTempChecks).toHaveLength(1);
  });
});

describe('cloud merge', () => {
  it('adds cloud-only readings and keeps newer local versions', () => {
    useStore.getState().addFridgeTempCheck(baseCheck);
    const local = useStore.getState().fridgeTempChecks[0];
    const remote = { ...baseCheck, id: 'remote1', timestamp: 100, modifiedAt: 100 };
    const stale = { ...local, temperature: 99, modifiedAt: local.modifiedAt - 1000 };
    useStore.getState().applyCloudState({ fridgeTempChecks: [remote, stale] } as any);
    const checks = useStore.getState().fridgeTempChecks;
    expect(checks.map((c) => c.id)).toContain('remote1');
    expect(checks.find((c) => c.id === local.id)?.temperature).toBe(3);
  });
});
