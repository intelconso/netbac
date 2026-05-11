import { doc, setDoc, getDoc, onSnapshot } from '@react-native-firebase/firestore';
import { db } from './firebase';
import { useStore } from './store';
import { AppState } from '../types';

const COLLECTION = 'users';
const DEBOUNCE_MS = 1000;

// Fields we don't want to ship to the cloud (UI-local / sync-meta only)
const TRANSIENT_KEYS = ['isOffline', 'lastSyncAt', 'lastSyncStatus', 'lastSyncError'] as const;

export type CloudPayload = Omit<AppState, (typeof TRANSIENT_KEYS)[number]> & { updatedAt: number };

// `@react-native-firebase/firestore` exposes `exists` as a property (boolean),
// while the Firebase Web SDK exposes it as a method. Handle both shapes.
function snapExists(snap: any): boolean {
  if (!snap) return false;
  return typeof snap.exists === 'function' ? !!snap.exists() : !!snap.exists;
}

export function serializeStateForCloud(state: AppState): CloudPayload {
  const payload: any = { ...state };
  for (const key of TRANSIENT_KEYS) delete payload[key];
  payload.updatedAt = Date.now();
  return payload;
}

function userDoc(uid: string) {
  return doc(db, COLLECTION, uid);
}

export async function pushToCloud(uid: string | null): Promise<void> {
  if (!uid) return;
  const { setSyncState } = useStore.getState();
  setSyncState({ status: 'syncing' });
  try {
    const payload = serializeStateForCloud(useStore.getState());
    await setDoc(userDoc(uid), payload);
    setSyncState({ status: 'synced', at: Date.now(), error: null });
  } catch (e: any) {
    setSyncState({ status: 'error', error: e?.message ?? 'Unknown error' });
  }
}

export async function pullFromCloud(uid: string | null): Promise<void> {
  if (!uid) return;
  const { applyCloudState, setSyncState } = useStore.getState();
  setSyncState({ status: 'syncing' });
  try {
    const snap = await getDoc(userDoc(uid));
    if (snapExists(snap)) {
      const data = snap.data() as CloudPayload | undefined;
      if (data) {
        // strip server-only fields before merging
        const { updatedAt: _u, ...rest } = data;
        applyCloudState(rest as Partial<AppState>);
      }
      setSyncState({ status: 'synced', at: Date.now(), error: null });
    } else {
      // No cloud doc — push local as the seed
      const payload = serializeStateForCloud(useStore.getState());
      await setDoc(userDoc(uid), payload);
      setSyncState({ status: 'synced', at: Date.now(), error: null });
    }
  } catch (e: any) {
    setSyncState({ status: 'error', error: e?.message ?? 'Unknown error' });
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let unsubscribeStore: (() => void) | null = null;
let unsubscribeFirestore: (() => void) | null = null;
let activeUid: string | null = null;

export function startSync(uid: string): void {
  if (activeUid === uid) return;
  stopSync();
  activeUid = uid;

  // 1. Initial pull (or seed if cloud is empty)
  pullFromCloud(uid).catch(() => {});

  // 2. Live subscription — apply remote changes that arrive after our local snapshot
  unsubscribeFirestore = onSnapshot(userDoc(uid), (snap: any) => {
    if (!snapExists(snap)) return;
    const data = snap.data() as CloudPayload | undefined;
    if (!data) return;
    const localUpdatedAt = useStore.getState().lastSyncAt ?? 0;
    if ((data.updatedAt ?? 0) > localUpdatedAt) {
      const { updatedAt: _u, ...rest } = data;
      useStore.getState().applyCloudState(rest as Partial<AppState>);
      useStore.getState().setSyncState({ status: 'synced', at: Date.now(), error: null });
    }
  });

  // 3. Debounced write-through on every local mutation.
  // Subscribe to a selector of *data only* slices, otherwise the sync-meta
  // updates (lastSyncStatus / lastSyncAt) feed back into the listener and
  // trigger an infinite push loop.
  let lastDataSnapshot: string | null = null;
  unsubscribeStore = useStore.subscribe((state) => {
    const dataKey = JSON.stringify({
      zones: state.zones,
      storageUnits: state.storageUnits,
      shelves: state.shelves,
      bacs: state.bacs,
      products: state.products,
      logs: state.logs,
      tempLogs: state.tempLogs,
      cleaningTasks: state.cleaningTasks,
      user: state.user,
    });
    if (lastDataSnapshot === dataKey) return;
    lastDataSnapshot = dataKey;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (activeUid) pushToCloud(activeUid);
    }, DEBOUNCE_MS);
  });
}

export function stopSync(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  activeUid = null;
}
