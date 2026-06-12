// Contrôles nettoyage — one daily check per cleaning zone. Zones are a
// parametrable label list (defaults match the paper register rows); records
// snapshot the zone label. Non-conform results carry a corrective action.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

describe('cleaning areas', () => {
  it('seeds the three paper register zones by default', () => {
    expect(useStore.getState().cleaningAreas).toEqual(['Restaurant / Salle', 'Cuisine / Stockage', 'Locaux communs']);
  });

  it('adds and removes zones, ignoring duplicates and blanks', () => {
    useStore.getState().addCleaningArea('Terrasse');
    useStore.getState().addCleaningArea('Terrasse');
    useStore.getState().addCleaningArea('   ');
    expect(useStore.getState().cleaningAreas.filter((a) => a === 'Terrasse')).toHaveLength(1);
    useStore.getState().deleteCleaningArea('Terrasse');
    expect(useStore.getState().cleaningAreas).not.toContain('Terrasse');
  });
});

describe('cleaning check CRUD', () => {
  it('records a conform check with stamps', () => {
    useStore.getState().addCleaningCheck({ area: 'Cuisine / Stockage', result: 'conforme' });
    const [check] = useStore.getState().cleaningChecks;
    expect(check.area).toBe('Cuisine / Stockage');
    expect(check.result).toBe('conforme');
    expect(check.recordedAt).toBe(check.timestamp);
  });

  it('records a non-conform check with its corrective action', () => {
    useStore.getState().addCleaningCheck({ area: 'Restaurant / Salle', result: 'non_conforme', correctiveAction: 'Sol renettoyé' });
    const [check] = useStore.getState().cleaningChecks;
    expect(check.result).toBe('non_conforme');
    expect(check.correctiveAction).toBe('Sol renettoyé');
  });

  it('keeps rendering after the zone is deleted (label snapshot)', () => {
    useStore.getState().addCleaningArea('Terrasse');
    useStore.getState().addCleaningCheck({ area: 'Terrasse', result: 'conforme' });
    useStore.getState().deleteCleaningArea('Terrasse');
    expect(useStore.getState().cleaningChecks[0].area).toBe('Terrasse');
  });

  it('edits in place and soft-deletes with a tombstone', () => {
    useStore.getState().addCleaningCheck({ area: 'Locaux communs', result: 'conforme' });
    const before = useStore.getState().cleaningChecks[0];
    useStore.getState().updateCleaningCheck(before.id, { result: 'non_conforme', correctiveAction: 'Repassage' });
    const after = useStore.getState().cleaningChecks[0];
    expect(after.result).toBe('non_conforme');
    expect(after.timestamp).toBe(before.timestamp);
    useStore.getState().deleteCleaningCheck(before.id);
    expect(useStore.getState().cleaningChecks[0].deletedAt).toBeGreaterThan(0);
  });

  it('backfills a missed day at that day timestamp with the flag', () => {
    const yesterday = Date.now() - 86400000;
    useStore.getState().addCleaningCheck({ area: 'Cuisine / Stockage', result: 'conforme', backfilled: true }, { timestamp: yesterday });
    const [check] = useStore.getState().cleaningChecks;
    expect(check.timestamp).toBe(yesterday);
    expect(check.backfilled).toBe(true);
  });
});

describe('cloud merge', () => {
  it('merges checks newer-wins and unions area lists', () => {
    useStore.getState().addCleaningCheck({ area: 'Locaux communs', result: 'conforme' });
    const local = useStore.getState().cleaningChecks[0];
    const remote = { area: 'Terrasse', result: 'conforme' as const, id: 'remote1', timestamp: 100, modifiedAt: 100 };
    useStore.getState().applyCloudState({ cleaningChecks: [remote], cleaningAreas: ['Terrasse'] } as any);
    expect(useStore.getState().cleaningChecks.map((c) => c.id)).toEqual(expect.arrayContaining([local.id, 'remote1']));
    expect(useStore.getState().cleaningAreas).toEqual(expect.arrayContaining(['Restaurant / Salle', 'Terrasse']));
  });
});
