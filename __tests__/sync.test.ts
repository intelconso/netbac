/**
 * Sync layer behavior tests.
 * The Firestore SDK is mocked via __mocks__/firestore (set up below).
 */

// Mock @react-native-firebase/firestore BEFORE importing anything that uses it
const mockSnapshot = { exists: jest.fn(() => false), data: jest.fn(() => null) };
const mockSetDoc = jest.fn(async (_ref: any, _data: any) => {});
const mockGetDoc = jest.fn(async () => mockSnapshot);

jest.mock('@react-native-firebase/firestore', () => {
  return {
    getFirestore: jest.fn(() => ({})),
    doc: jest.fn((_db: any, coll: string, id: string) => ({ coll, id })),
    setDoc: (...args: any[]) => mockSetDoc(args[0], args[1]),
    getDoc: (...args: any[]) => mockGetDoc(),
    onSnapshot: jest.fn((_ref: any, cb: any) => {
      cb(mockSnapshot);
      return () => {};
    }),
    serverTimestamp: jest.fn(() => 'SERVER_TIMESTAMP'),
  };
});

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn(),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import { pushToCloud, pullFromCloud, serializeStateForCloud } from '../src/lib/sync';

const initialStoreState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialStoreState, true);
  mockSnapshot.exists.mockReset();
  mockSnapshot.data.mockReset();
  mockSetDoc.mockClear();
  mockGetDoc.mockClear();
  mockSetDoc.mockResolvedValue(undefined);
});

describe('serializeStateForCloud', () => {
  it('strips transient fields (isOffline, lastSync*) from upload payload', () => {
    const state = useStore.getState();
    const payload = serializeStateForCloud(state);
    expect(payload).not.toHaveProperty('isOffline');
    expect(payload).not.toHaveProperty('lastSyncAt');
    expect(payload).not.toHaveProperty('lastSyncStatus');
    expect(payload).not.toHaveProperty('lastSyncError');
  });

  it('includes core data (zones, products, etc.)', () => {
    const state = useStore.getState();
    const payload = serializeStateForCloud(state);
    expect(payload).toHaveProperty('zones');
    expect(payload).toHaveProperty('products');
    expect(payload).toHaveProperty('bacs');
  });

  it('includes the team checklist (employees, tasks, completions)', () => {
    const payload = serializeStateForCloud(useStore.getState());
    expect(payload).toHaveProperty('employees');
    expect(payload).toHaveProperty('tasks');
    expect(payload).toHaveProperty('taskCompletions');
  });

  it('includes a numeric updatedAt for last-write-wins', () => {
    const before = Date.now();
    const payload = serializeStateForCloud(useStore.getState());
    const after = Date.now();
    expect(typeof payload.updatedAt).toBe('number');
    expect(payload.updatedAt).toBeGreaterThanOrEqual(before);
    expect(payload.updatedAt).toBeLessThanOrEqual(after);
  });
});

describe('pushToCloud', () => {
  it('writes the serialized state and updates lastSyncAt + status=synced', async () => {
    await pushToCloud('user-A');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    const state = useStore.getState();
    expect(state.lastSyncStatus).toBe('synced');
    expect(state.lastSyncAt).toBeGreaterThan(0);
    expect(state.lastSyncError).toBeNull();
  });

  it('captures the error and sets status=error on failure', async () => {
    mockSetDoc.mockRejectedValueOnce(new Error('network down'));
    await pushToCloud('user-A');
    const state = useStore.getState();
    expect(state.lastSyncStatus).toBe('error');
    expect(state.lastSyncError).toBe('network down');
  });

  it('skips silently when uid is null (anon)', async () => {
    await pushToCloud(null);
    expect(mockSetDoc).not.toHaveBeenCalled();
  });
});

describe('pullFromCloud', () => {
  it('seeds the cloud with local state when no doc exists yet', async () => {
    mockSnapshot.exists.mockReturnValue(false);
    await pullFromCloud('user-A');
    expect(mockSetDoc).toHaveBeenCalledTimes(1);
  });

  it('replaces local state when cloud doc exists', async () => {
    mockSnapshot.exists.mockReturnValue(true);
    const cloudZones = [{ id: 'cloud-z1', name: 'Cuisine Cloud', type: 'cuisine' as const }];
    mockSnapshot.data.mockReturnValue({
      zones: cloudZones,
      storageUnits: [],
      shelves: [],
      bacs: [],
      products: [],
      tempLogs: [],
      cleaningTasks: [],
      updatedAt: Date.now(),
    });
    await pullFromCloud('user-A');
    expect(useStore.getState().zones).toEqual(cloudZones);
  });

  it('skips when uid is null', async () => {
    await pullFromCloud(null);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});

// Un pull échoué ne doit JAMAIS être suivi d'un push : pushToCloud écrit le
// document ENTIER, donc publier un état local qui n'a rien lu efface d'un coup
// ce qu'un autre appareil avait mis dans le cloud.
describe('pullFromCloud — contrat de retour', () => {
  it('rend true quand la lecture aboutit', async () => {
    mockSnapshot.exists.mockReturnValue(false);
    await expect(pullFromCloud('user-A')).resolves.toBe(true);
    expect(useStore.getState().lastSyncStatus).toBe('synced');
  });

  it('rend false et passe en erreur quand la lecture échoue', async () => {
    mockGetDoc.mockRejectedValueOnce(new Error('network down'));
    await expect(pullFromCloud('user-A')).resolves.toBe(false);
    expect(useStore.getState().lastSyncStatus).toBe('error');
    expect(useStore.getState().lastSyncError).toBe('network down');
  });

  it('rend false sans rien lire quand il n\'y a pas d\'uid', async () => {
    await expect(pullFromCloud(null)).resolves.toBe(false);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});
