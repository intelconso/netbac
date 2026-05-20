import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Bac, Product, User, Zone, StorageUnit, Shelf, ActivityLog, TemperatureLog, CleaningTask } from '../types';
import { randomId } from './utils';

interface StoreActions {
  addZone: (zone: Omit<Zone, 'id' | 'modifiedAt'>) => void;
  updateZone: (id: string, zone: Partial<Omit<Zone, 'id' | 'modifiedAt'>>) => void;
  deleteZone: (id: string) => void;
  addStorageUnit: (unit: Omit<StorageUnit, 'id' | 'modifiedAt'>) => void;
  updateStorageUnit: (id: string, unit: Partial<Omit<StorageUnit, 'id' | 'modifiedAt'>>) => void;
  deleteStorageUnit: (id: string) => void;
  addShelf: (shelf: Omit<Shelf, 'id' | 'modifiedAt'>) => void;
  updateShelf: (id: string, shelf: Partial<Omit<Shelf, 'id' | 'modifiedAt'>>) => void;
  deleteShelf: (id: string) => void;
  setUnitShelves: (unitId: string, count: number) => void;
  addBac: (bac: Omit<Bac, 'id' | 'createdAt' | 'modifiedAt' | 'syncStatus'>) => void;
  updateBac: (id: string, bac: Partial<Omit<Bac, 'id' | 'createdAt' | 'modifiedAt' | 'syncStatus'>>) => void;
  deleteBac: (id: string) => void;
  addProduct: (product: Omit<Product, 'id' | 'addedAt' | 'modifiedAt' | 'syncStatus' | 'status'>) => string;
  updateProductStatus: (id: string, status: Product['status']) => void;
  updateProduct: (id: string, product: Partial<Omit<Product, 'id' | 'addedAt' | 'modifiedAt' | 'syncStatus' | 'status'>>) => void;
  deleteProduct: (id: string) => void;
  addProductUnit: (name: string) => void;
  updateProductUnit: (oldName: string, newName: string) => void;
  deleteProductUnit: (name: string) => void;
  addTempLog: (log: Omit<TemperatureLog, 'id' | 'timestamp'>) => void;
  completeCleaningTask: (taskId: string) => void;
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'userId' | 'userName'>) => void;
  setUser: (user: User | null) => void;
  updateSettings: (settings: Partial<User['settings']>) => void;
  setOffline: (isOffline: boolean) => void;
  setSyncState: (state: { status?: AppState['lastSyncStatus']; at?: number | null; error?: string | null }) => void;
  applyCloudState: (cloud: Partial<AppState>) => void;
  resetState: () => void;
}

const INITIAL_STATE: AppState = {
  zones: [],
  storageUnits: [],
  shelves: [],
  bacs: [],
  products: [],
  logs: [],
  tempLogs: [],
  cleaningTasks: [],
  productUnits: ['kg', 'g', 'pce', 'L', 'broche', 'bacs'],
  user: null,
  isOffline: false,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
};

// Soft-delete: items are not removed from arrays, only flagged with `deletedAt`.
// This lets the merge logic propagate deletions across devices via the same
// "newer modifiedAt wins" rule used for edits, without ever physically losing
// data that another device might still hold.
const tomb = <T extends { modifiedAt: number; deletedAt?: number }>(item: T): T => ({
  ...item,
  modifiedAt: Date.now(),
  deletedAt: Date.now(),
});

export const useStore = create<AppState & StoreActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      addZone: (zone) => set((state) => ({
        zones: [...state.zones, { ...zone, id: randomId(), modifiedAt: Date.now() }],
      })),

      updateZone: (id, zone) => set((state) => ({
        zones: state.zones.map((z) => (z.id === id ? { ...z, ...zone, modifiedAt: Date.now() } : z)),
      })),

      deleteZone: (id) => set((state) => {
        const childUnitIds = state.storageUnits.filter((u) => u.zoneId === id).map((u) => u.id);
        const childShelfIds = state.shelves.filter((s) => childUnitIds.includes(s.unitId)).map((s) => s.id);
        const childBacIds = state.bacs.filter((b) => childShelfIds.includes(b.shelfId)).map((b) => b.id);
        return {
          zones: state.zones.map((z) => (z.id === id ? tomb(z) : z)),
          storageUnits: state.storageUnits.map((u) => (childUnitIds.includes(u.id) ? tomb(u) : u)),
          shelves: state.shelves.map((s) => (childShelfIds.includes(s.id) ? tomb(s) : s)),
          bacs: state.bacs.map((b) => (childBacIds.includes(b.id) ? tomb(b) : b)),
          products: state.products.map((p) => (childBacIds.includes(p.bacId) ? tomb(p) : p)),
        };
      }),

      addStorageUnit: (unit) => set((state) => ({
        storageUnits: [...state.storageUnits, { ...unit, id: randomId(), modifiedAt: Date.now() }],
      })),

      updateStorageUnit: (id, unit) => set((state) => ({
        storageUnits: state.storageUnits.map((u) => (u.id === id ? { ...u, ...unit, modifiedAt: Date.now() } : u)),
      })),

      deleteStorageUnit: (id) => set((state) => {
        const childShelfIds = state.shelves.filter((s) => s.unitId === id).map((s) => s.id);
        const childBacIds = state.bacs.filter((b) => childShelfIds.includes(b.shelfId)).map((b) => b.id);
        return {
          storageUnits: state.storageUnits.map((u) => (u.id === id ? tomb(u) : u)),
          shelves: state.shelves.map((s) => (childShelfIds.includes(s.id) ? tomb(s) : s)),
          bacs: state.bacs.map((b) => (childBacIds.includes(b.id) ? tomb(b) : b)),
          products: state.products.map((p) => (childBacIds.includes(p.bacId) ? tomb(p) : p)),
        };
      }),

      addShelf: (shelf) => set((state) => ({
        shelves: [...state.shelves, { ...shelf, id: randomId(), modifiedAt: Date.now() }],
      })),

      updateShelf: (id, shelf) => set((state) => ({
        shelves: state.shelves.map((s) => (s.id === id ? { ...s, ...shelf, modifiedAt: Date.now() } : s)),
      })),

      deleteShelf: (id) => set((state) => {
        const childBacIds = state.bacs.filter((b) => b.shelfId === id).map((b) => b.id);
        return {
          shelves: state.shelves.map((s) => (s.id === id ? tomb(s) : s)),
          bacs: state.bacs.map((b) => (childBacIds.includes(b.id) ? tomb(b) : b)),
          products: state.products.map((p) => (childBacIds.includes(p.bacId) ? tomb(p) : p)),
        };
      }),

      setUnitShelves: (unitId, count) => set((state) => {
        const liveShelves = state.shelves.filter((s) => s.unitId === unitId && !s.deletedAt);
        const others = state.shelves.filter((s) => s.unitId !== unitId);
        const tombs = state.shelves.filter((s) => s.unitId === unitId && s.deletedAt);
        const next: Shelf[] = Array.from({ length: count }, (_, i) => {
          const level = i + 1;
          const existing = liveShelves.find((s) => s.level === level);
          return existing
            ? { ...existing, modifiedAt: existing.modifiedAt ?? Date.now() }
            : { id: randomId(), unitId, level, name: `Niveau ${level}`, modifiedAt: Date.now() };
        });
        // Any live shelf above `count` gets tombstoned along with its bacs/products
        const removed = liveShelves.filter((s) => s.level > count);
        const removedIds = new Set(removed.map((s) => s.id));
        const removedBacIds = new Set(state.bacs.filter((b) => removedIds.has(b.shelfId)).map((b) => b.id));
        return {
          shelves: [...others, ...next, ...tombs, ...removed.map(tomb)].sort((a, b) => a.level - b.level),
          bacs: state.bacs.map((b) => (removedBacIds.has(b.id) ? tomb(b) : b)),
          products: state.products.map((p) => (removedBacIds.has(p.bacId) ? tomb(p) : p)),
        };
      }),

      addBac: (bac) => set((state) => ({
        bacs: [...state.bacs, {
          ...bac,
          id: randomId(),
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          syncStatus: state.isOffline ? 'offline' : 'pending',
        }],
      })),

      updateBac: (id, bac) => set((state) => ({
        bacs: state.bacs.map((b) => (b.id === id ? { ...b, ...bac, modifiedAt: Date.now() } : b)),
      })),

      deleteBac: (id) => set((state) => ({
        bacs: state.bacs.map((b) => (b.id === id ? tomb(b) : b)),
        products: state.products.map((p) => (p.bacId === id ? tomb(p) : p)),
      })),

      addProduct: (product) => {
        const id = randomId();
        set((state) => ({
          products: [...state.products, {
            ...product,
            id,
            addedAt: Date.now(),
            modifiedAt: Date.now(),
            status: 'active',
            syncStatus: state.isOffline ? 'offline' : 'pending',
          }],
        }));
        get().addLog({ action: 'add_product', details: `Ajout du produit: ${product.name}`, entityId: id });
        return id;
      },

      updateProductStatus: (id, status) => {
        const product = get().products.find((p) => p.id === id);
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, status, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' } : p
          ),
        }));
        if (product) {
          get().addLog({
            action: status === 'used' ? 'use_product' : 'discard_product',
            details: `${status === 'used' ? 'Utilisation' : 'Mise au rebut'} de: ${product.name}`,
            entityId: id,
          });
        }
      },

      updateProduct: (id, productData) => {
        const product = get().products.find((p) => p.id === id);
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...productData, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' } : p
          ),
        }));
        if (product) {
          get().addLog({ action: 'update_product', details: `Mise à jour du produit: ${product.name}`, entityId: id });
        }
      },

      deleteProduct: (id) => set((state) => ({
        products: state.products.map((p) => (p.id === id ? tomb(p) : p)),
      })),

      addProductUnit: (name) => set((state) => {
        const trimmed = name.trim();
        if (!trimmed || state.productUnits.includes(trimmed)) return {};
        return { productUnits: [...state.productUnits, trimmed] };
      }),

      updateProductUnit: (oldName, newName) => set((state) => {
        const trimmed = newName.trim();
        if (!trimmed) return {};
        return { productUnits: state.productUnits.map((u) => (u === oldName ? trimmed : u)) };
      }),

      deleteProductUnit: (name) => set((state) => ({
        productUnits: state.productUnits.filter((u) => u !== name),
      })),

      addTempLog: (log) => {
        const id = randomId();
        const timestamp = Date.now();
        const unitName = get().storageUnits.find((u) => u.id === log.unitId)?.name || 'Unité inconnue';
        set((state) => ({ tempLogs: [...state.tempLogs, { ...log, id, timestamp } as TemperatureLog] }));
        get().addLog({
          action: 'temp_check',
          details: `Relevé de température: ${log.temperature}°C pour ${unitName}`,
          entityId: id,
        });
      },

      completeCleaningTask: (taskId) => {
        const now = Date.now();
        const task = get().cleaningTasks.find((t) => t.id === taskId);
        if (!task) return;
        let nextDue = now;
        if (task.frequency === 'daily') nextDue += 24 * 60 * 60 * 1000;
        else if (task.frequency === 'weekly') nextDue += 7 * 24 * 60 * 60 * 1000;
        else if (task.frequency === 'monthly') nextDue += 30 * 24 * 60 * 60 * 1000;
        set((state) => ({
          cleaningTasks: state.cleaningTasks.map((t) => (t.id === taskId ? { ...t, lastDone: now, nextDue, modifiedAt: now } : t)),
        }));
        get().addLog({ action: 'cleaning', details: `Nettoyage effectué: ${task.name}`, entityId: taskId });
      },

      addLog: (log) => {
        const user = get().user;
        set((state) => ({
          logs: [{
            ...log,
            id: randomId(),
            timestamp: Date.now(),
            userId: user?.id || 'unknown',
            userName: user?.name || 'Inconnu',
          } as ActivityLog, ...state.logs],
        }));
      },

      setUser: (user) => set({ user }),

      updateSettings: (newSettings) => set((state) => ({
        user: state.user ? { ...state.user, settings: { ...state.user.settings, ...newSettings } } : null,
      })),

      setOffline: (isOffline) => set({ isOffline }),

      setSyncState: ({ status, at, error }) =>
        set((state) => ({
          lastSyncStatus: status ?? state.lastSyncStatus,
          lastSyncAt: at !== undefined ? at : state.lastSyncAt,
          lastSyncError: error !== undefined ? error : state.lastSyncError,
        })),

      // Union-merge cloud state INTO local. Local items are NEVER removed
      // just because the cloud is missing them. For every item type:
      //   - cloud-only items are added to local
      //   - items present on both sides: whichever has the newer modifiedAt wins
      //     (this also propagates tombstones, since deletions bump modifiedAt
      //     and add `deletedAt` to the item)
      // The UI is responsible for filtering out items with `deletedAt` set.
      applyCloudState: (cloud) =>
        set((state) => {
          if (!cloud || typeof cloud !== 'object') return state;
          const mergeNewer = <T extends { id: string; modifiedAt?: number }>(local: T[], remote: T[] | undefined): T[] => {
            if (!Array.isArray(remote)) return local;
            const map = new Map<string, T>();
            for (const item of local) if (item && item.id) map.set(item.id, item);
            for (const item of remote) {
              if (!item || !item.id) continue;
              const existing = map.get(item.id);
              if (!existing) {
                map.set(item.id, item);
              } else if ((item.modifiedAt ?? 0) > (existing.modifiedAt ?? 0)) {
                map.set(item.id, item);
              }
            }
            return Array.from(map.values());
          };
          // Logs and tempLogs are append-only history; no modifiedAt, just dedupe by id.
          const mergeAppendOnly = <T extends { id: string }>(local: T[], remote: T[] | undefined): T[] => {
            if (!Array.isArray(remote)) return local;
            const map = new Map<string, T>();
            for (const item of local) if (item && item.id) map.set(item.id, item);
            for (const item of remote) {
              if (!item || !item.id) continue;
              if (!map.has(item.id)) map.set(item.id, item);
            }
            return Array.from(map.values());
          };
          return {
            zones: mergeNewer(state.zones, cloud.zones),
            storageUnits: mergeNewer(state.storageUnits, cloud.storageUnits),
            shelves: mergeNewer(state.shelves, cloud.shelves),
            bacs: mergeNewer(state.bacs, cloud.bacs),
            products: mergeNewer(state.products, cloud.products),
            logs: mergeAppendOnly(state.logs, cloud.logs),
            tempLogs: mergeAppendOnly(state.tempLogs, cloud.tempLogs),
            cleaningTasks: mergeNewer(state.cleaningTasks, cloud.cleaningTasks),
            productUnits: Array.from(new Set([...(state.productUnits ?? []), ...((cloud.productUnits as string[]) ?? [])])),
            user: state.user ?? cloud.user ?? null,
          } as Partial<AppState> as any;
        }),

      resetState: () => set(INITIAL_STATE),
    }),
    {
      name: 'netbac-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state): AppState => ({
        zones: state.zones,
        storageUnits: state.storageUnits,
        shelves: state.shelves,
        bacs: state.bacs,
        products: state.products,
        logs: state.logs,
        tempLogs: state.tempLogs,
        cleaningTasks: state.cleaningTasks,
        productUnits: state.productUnits,
        user: state.user,
        isOffline: state.isOffline,
        lastSyncAt: state.lastSyncAt,
        lastSyncStatus: state.lastSyncStatus,
        lastSyncError: state.lastSyncError,
      }),
      merge: (persistedState, currentState) => {
        const merged: Record<string, unknown> = { ...currentState };
        if (persistedState && typeof persistedState === 'object') {
          const p = persistedState as Record<string, unknown>;
          const c = currentState as unknown as Record<string, unknown>;
          for (const key in p) {
            if (p[key] === undefined) continue;
            if (typeof c[key] === 'function') continue;
            merged[key] = p[key];
          }
        }
        return merged as unknown as AppState & StoreActions;
      },
    }
  )
);

export async function switchStoreToUser(uid: string | null) {
  const newKey = uid ? `netbac-storage-${uid}` : 'netbac-storage-anon';
  useStore.persist.setOptions({ name: newKey });
  const stored = await AsyncStorage.getItem(newKey);
  if (stored) {
    await useStore.persist.rehydrate();
  } else {
    useStore.getState().resetState();
  }
}
