// Remarques de la journée (free-text log) and prélèvement des plats témoins
// (one oui/non per day, restauration collective). Same sync semantics as the
// other register controls.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

describe('daily remarks', () => {
  it('records a remark with stamps and controller', () => {
    useStore.getState().addDailyRemark({ text: 'Visite DDPP ce matin, RAS', operatorName: 'Fares' });
    const [r] = useStore.getState().dailyRemarks;
    expect(r.text).toBe('Visite DDPP ce matin, RAS');
    expect(r.operatorName).toBe('Fares');
    expect(r.recordedAt).toBe(r.timestamp);
  });

  it('edits in place and soft-deletes with a tombstone', () => {
    useStore.getState().addDailyRemark({ text: 'brouillon' });
    const before = useStore.getState().dailyRemarks[0];
    useStore.getState().updateDailyRemark(before.id, { text: 'corrigé' });
    expect(useStore.getState().dailyRemarks[0].text).toBe('corrigé');
    expect(useStore.getState().dailyRemarks[0].timestamp).toBe(before.timestamp);
    useStore.getState().deleteDailyRemark(before.id);
    expect(useStore.getState().dailyRemarks[0].deletedAt).toBeGreaterThan(0);
  });
});

describe('witness samples', () => {
  it('records the daily oui/non', () => {
    useStore.getState().addWitnessSample({ taken: true, operatorName: 'Fares' });
    const [s] = useStore.getState().witnessSamples;
    expect(s.taken).toBe(true);
    expect(s.recordedAt).toBe(s.timestamp);
  });

  it('edits the day answer in place', () => {
    useStore.getState().addWitnessSample({ taken: true });
    const before = useStore.getState().witnessSamples[0];
    useStore.getState().updateWitnessSample(before.id, { taken: false });
    expect(useStore.getState().witnessSamples[0].taken).toBe(false);
    expect(useStore.getState().witnessSamples).toHaveLength(1);
  });
});

describe('cloud merge', () => {
  it('merges both arrays with newer-modifiedAt-wins', () => {
    useStore.getState().addDailyRemark({ text: 'local' });
    useStore.getState().applyCloudState({
      dailyRemarks: [{ id: 'remote-r', text: 'remote', timestamp: 100, modifiedAt: 100 }],
      witnessSamples: [{ id: 'remote-w', taken: true, timestamp: 100, modifiedAt: 100 }],
    } as any);
    expect(useStore.getState().dailyRemarks.map((r) => r.id)).toContain('remote-r');
    expect(useStore.getState().witnessSamples.map((s) => s.id)).toContain('remote-w');
    expect(useStore.getState().dailyRemarks.some((r) => r.text === 'local')).toBe(true);
  });
});
