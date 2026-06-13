import { doc, setDoc, getDoc, onSnapshot } from '@react-native-firebase/firestore';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { db } from './firebase';
import { useStore } from './store';
import { AppState } from '../types';

const COLLECTION = 'users';
const DEBOUNCE_MS = 1000;
const RETRY_MS = 30_000;

// Allowlist of data fields that belong in the cloud doc. Everything else on
// the store object (Zustand actions, sync metadata, UI flags) is excluded —
// otherwise functions get coerced to null in Firestore or, in some cases,
// cause "unsupported field value" errors that surface as
// "Erreur de synchronisation" in the UI.
const CLOUD_KEYS = [
  'zones',
  'storageUnits',
  'shelves',
  'bacs',
  'products',
  'tempLogs',
  'cleaningTasks',
  'oilChecks',
  'fridgeTempChecks',
  'fabrications',
  'fabricationTypes',
  'cleaningChecks',
  'cleaningAreas',
  'closedWeekdays',
  'singleServiceWeekdays',
  'dayOverrides',
  'receptions',
  'dailyRemarks',
  'witnessSamples',
  'productUnits',
  'customActionTypes',
  'defaultActionTypeStates',
  'user',
] as const;

export type CloudPayload = Pick<AppState, (typeof CLOUD_KEYS)[number]> & { updatedAt: number };

function snapExists(snap: any): boolean {
  if (!snap) return false;
  return typeof snap.exists === 'function' ? !!snap.exists() : !!snap.exists;
}

// Firestore rejects any field with `undefined` as a value ("Unsupported field
// value: undefined"). React state easily produces these via optional props
// that aren't filled in (e.g. temperature, origin). Strip them before
// pushing — null is fine, missing is fine, undefined explodes.
function stripUndefined(value: any): any {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(stripUndefined).filter((v) => v !== undefined);
  if (typeof value === 'object') {
    const out: any = {};
    for (const k in value) {
      const v = stripUndefined(value[k]);
      if (v === undefined) continue;
      out[k] = v;
    }
    return out;
  }
  return value;
}

export function serializeStateForCloud(state: AppState): CloudPayload {
  const payload: any = { updatedAt: Date.now() };
  for (const key of CLOUD_KEYS) {
    const value = (state as any)[key];
    if (value === undefined) continue;
    payload[key] = stripUndefined(value);
  }
  return payload as CloudPayload;
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

// Pulling merges cloud into local (union-merge in applyCloudState).
// Local items are NEVER deleted because the cloud doesn't have them.
export async function pullFromCloud(uid: string | null): Promise<void> {
  if (!uid) return;
  const { applyCloudState, setSyncState } = useStore.getState();
  setSyncState({ status: 'syncing' });
  try {
    const snap = await getDoc(userDoc(uid));
    if (snapExists(snap)) {
      const data = snap.data() as CloudPayload | undefined;
      if (data) {
        const { updatedAt: _u, ...rest } = data;
        applyCloudState(rest as Partial<AppState>);
      }
    }
    setSyncState({ status: 'synced', at: Date.now(), error: null });
  } catch (e: any) {
    setSyncState({ status: 'error', error: e?.message ?? 'Unknown error' });
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeStore: (() => void) | null = null;
let unsubscribeFirestore: (() => void) | null = null;
let unsubscribeNetInfo: (() => void) | null = null;
let activeUid: string | null = null;

export function startSync(uid: string): void {
  if (activeUid === uid) return;
  stopSync();
  activeUid = uid;

  // 1. Initial pull (union-merge) followed by a push of the merged state.
  //    Local-only items make it up; cloud-only items land locally. No loss.
  pullFromCloud(uid)
    .then(() => pushToCloud(uid))
    .catch(() => {});

  // 2. Live subscription for cross-device sync. Union-merge means incoming
  //    remote items are added/updated locally without ever deleting local items
  //    that the cloud is missing.
  unsubscribeFirestore = onSnapshot(userDoc(uid), (snap: any) => {
    if (!snapExists(snap)) return;
    const data = snap.data() as CloudPayload | undefined;
    if (!data) return;
    const { updatedAt: _u, ...rest } = data;
    useStore.getState().applyCloudState(rest as Partial<AppState>);
  });

  // 3. Debounced write-through on every local mutation. A failed push leaves
  //    `lastSyncStatus: 'error'`; local data stays intact. The retry timer
  //    and NetInfo reconnect handler below will re-fire the push.
  let lastDataSnapshot: string | null = null;
  unsubscribeStore = useStore.subscribe((state) => {
    const dataKey = JSON.stringify({
      zones: state.zones,
      storageUnits: state.storageUnits,
      shelves: state.shelves,
      bacs: state.bacs,
      products: state.products,
      tempLogs: state.tempLogs,
      cleaningTasks: state.cleaningTasks,
      oilChecks: state.oilChecks,
      fridgeTempChecks: state.fridgeTempChecks,
      fabrications: state.fabrications,
      fabricationTypes: state.fabricationTypes,
      cleaningChecks: state.cleaningChecks,
      cleaningAreas: state.cleaningAreas,
      closedWeekdays: state.closedWeekdays,
      singleServiceWeekdays: state.singleServiceWeekdays,
      dayOverrides: state.dayOverrides,
      receptions: state.receptions,
      dailyRemarks: state.dailyRemarks,
      witnessSamples: state.witnessSamples,
      productUnits: state.productUnits,
      customActionTypes: state.customActionTypes,
      defaultActionTypeStates: state.defaultActionTypeStates,
      user: state.user,
    });
    if (lastDataSnapshot === dataKey) return;
    lastDataSnapshot = dataKey;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (activeUid) pushToCloud(activeUid);
    }, DEBOUNCE_MS);
  });

  // 4. Periodic retry while in error state. Catches "network was down at the
  //    moment of push AND no new mutation has happened since." Heartbeat is
  //    cheap; it only pushes when there's something to retry.
  retryTimer = setInterval(() => {
    if (!activeUid) return;
    const status = useStore.getState().lastSyncStatus;
    if (status === 'error') pushToCloud(activeUid);
  }, RETRY_MS);

  // 5. Reconnect-driven flush. The instant connectivity returns, push the
  //    full local state up. Doesn't wait for the next mutation or retry tick.
  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    if (state.isConnected && activeUid) {
      const status = useStore.getState().lastSyncStatus;
      if (status === 'error' || status === 'idle') pushToCloud(activeUid);
    }
  });
}

export function stopSync(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
  if (unsubscribeStore) {
    unsubscribeStore();
    unsubscribeStore = null;
  }
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  activeUid = null;
}
