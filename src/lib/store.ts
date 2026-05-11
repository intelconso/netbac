import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Bac, Product, User, Zone, StorageUnit, Shelf, ActivityLog, TemperatureLog, CleaningTask } from '../types';
import { randomId } from './utils';

interface StoreActions {
  addZone: (zone: Omit<Zone, 'id'>) => void;
  deleteZone: (id: string) => void;
  addStorageUnit: (unit: Omit<StorageUnit, 'id'>) => void;
  updateStorageUnit: (id: string, unit: Partial<Omit<StorageUnit, 'id'>>) => void;
  deleteStorageUnit: (id: string) => void;
  addShelf: (shelf: Omit<Shelf, 'id'>) => void;
  updateShelf: (id: string, shelf: Partial<Omit<Shelf, 'id'>>) => void;
  deleteShelf: (id: string) => void;
  setUnitShelves: (unitId: string, count: number) => void;
  addBac: (bac: Omit<Bac, 'id' | 'createdAt' | 'syncStatus'>) => void;
  updateBac: (id: string, bac: Partial<Omit<Bac, 'id' | 'createdAt' | 'syncStatus'>>) => void;
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

export const useStore = create<AppState & StoreActions>()(
  persist(
    (set, get) => ({
      ...INITIAL_STATE,

      addZone: (zone) => set((state) => ({
        zones: [...state.zones, { ...zone, id: randomId() }],
      })),

      deleteZone: (id) => set((state) => ({
        zones: state.zones.filter((z) => z.id !== id),
        storageUnits: state.storageUnits.filter((u) => u.zoneId !== id),
      })),

      addStorageUnit: (unit) => set((state) => ({
        storageUnits: [...state.storageUnits, { ...unit, id: randomId() }],
      })),

      updateStorageUnit: (id, unit) => set((state) => ({
        storageUnits: state.storageUnits.map((u) => (u.id === id ? { ...u, ...unit } : u)),
      })),

      deleteStorageUnit: (id) => set((state) => ({
        storageUnits: state.storageUnits.filter((u) => u.id !== id),
        shelves: state.shelves.filter((s) => s.unitId !== id),
      })),

      addShelf: (shelf) => set((state) => ({
        shelves: [...state.shelves, { ...shelf, id: randomId() }],
      })),

      updateShelf: (id, shelf) => set((state) => ({
        shelves: state.shelves.map((s) => (s.id === id ? { ...s, ...shelf } : s)),
      })),

      deleteShelf: (id) => set((state) => ({
        shelves: state.shelves.filter((s) => s.id !== id),
        bacs: state.bacs.filter((b) => b.shelfId !== id),
      })),

      setUnitShelves: (unitId, count) => set((state) => {
        const existingShelves = state.shelves.filter((s) => s.unitId === unitId);
        const otherShelves = state.shelves.filter((s) => s.unitId !== unitId);
        const newShelves = Array.from({ length: count }, (_, i) => {
          const level = i + 1;
          const existing = existingShelves.find((s) => s.level === level);
          return existing || { id: randomId(), unitId, level, name: `Niveau ${level}` };
        });
        return { shelves: [...otherShelves, ...newShelves].sort((a, b) => a.level - b.level) };
      }),

      addBac: (bac) => set((state) => ({
        bacs: [...state.bacs, {
          ...bac,
          id: randomId(),
          createdAt: Date.now(),
          syncStatus: state.isOffline ? 'offline' : 'pending',
        }],
      })),

      updateBac: (id, bac) => set((state) => ({
        bacs: state.bacs.map((b) => (b.id === id ? { ...b, ...bac } : b)),
      })),

      deleteBac: (id) => set((state) => ({
        bacs: state.bacs.filter((b) => b.id !== id),
        products: state.products.filter((p) => p.bacId !== id),
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
        products: state.products.filter((p) => p.id !== id),
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
          cleaningTasks: state.cleaningTasks.map((t) => (t.id === taskId ? { ...t, lastDone: now, nextDue } : t)),
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

      applyCloudState: (cloud) =>
        set((state) => {
          const merged: Record<string, unknown> = { ...state };
          if (cloud && typeof cloud === 'object') {
            const c = cloud as Record<string, unknown>;
            const s = state as unknown as Record<string, unknown>;
            for (const key in c) {
              if (c[key] === undefined) continue;
              // Never let cloud data overwrite a live action function
              if (typeof s[key] === 'function') continue;
              merged[key] = c[key];
            }
          }
          return merged as unknown as AppState & StoreActions;
        }),

      resetState: () => set(INITIAL_STATE),
    }),
    {
      name: 'netbac-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist only data fields. If we don't whitelist these, zustand serializes
      // action functions too — they become undefined in JSON and on rehydrate
      // overwrite the real actions, leaving the store with `setSyncState` etc. as null.
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
      // Defensive merge: even if older persisted snapshots contain undefined
      // action keys, never let them override real functions.
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
