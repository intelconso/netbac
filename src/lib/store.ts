import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, ActionType, Bac, CleaningCheck, CustomActionType, DailyRemark, DayOverride, DayServiceStatus, DefaultActionTypeState, Fabrication, FabricationField, FabricationType, FridgeTempCheck, OilCheck, Product, ReceptionCheck, TempUnit, User, WitnessSample, Zone, StorageUnit, Shelf, TemperatureLog, CleaningTask } from '../types';
import { randomId } from './utils';
import { deriveColdUnits } from './tempUnits';
import { dayOverrideId, startOfDayMs } from './serviceDays';

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
  updateProductStatus: (id: string, status: Product['status'], options?: { usedAt?: number }) => void;
  updateProduct: (id: string, product: Partial<Omit<Product, 'id' | 'addedAt' | 'modifiedAt' | 'syncStatus' | 'status'>>) => void;
  deleteProduct: (id: string) => void;
  addProductUnit: (name: string) => void;
  updateProductUnit: (oldName: string, newName: string) => void;
  deleteProductUnit: (name: string) => void;
  addCustomActionType: (data: { label: string; dlcDays: number }) => string;
  removeCustomActionType: (id: string) => { ok: boolean; error?: string };
  setDefaultActionTypeDisabled: (id: ActionType, disabled: boolean) => void;
  addTempLog: (log: Omit<TemperatureLog, 'id' | 'timestamp'>) => void;
  addOilCheck: (check: Omit<OilCheck, 'id' | 'timestamp' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateOilCheck: (id: string, check: Partial<Omit<OilCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteOilCheck: (id: string) => void;
  addFridgeTempCheck: (check: Omit<FridgeTempCheck, 'id' | 'timestamp' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateFridgeTempCheck: (id: string, check: Partial<Omit<FridgeTempCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteFridgeTempCheck: (id: string) => void;
  addFabrication: (fab: Omit<Fabrication, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateFabrication: (id: string, fab: Partial<Omit<Fabrication, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteFabrication: (id: string) => void;
  addFabricationType: (data: { label: string; fields: FabricationField[] }) => string;
  updateFabricationType: (id: string, data: Partial<Pick<FabricationType, 'label' | 'fields'>>) => void;
  removeFabricationType: (id: string) => void;
  addCleaningCheck: (check: Omit<CleaningCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateCleaningCheck: (id: string, check: Partial<Omit<CleaningCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteCleaningCheck: (id: string) => void;
  addCleaningArea: (name: string) => void;
  deleteCleaningArea: (name: string) => void;
  addTempUnit: (name: string, type: TempUnit['type']) => void;
  updateTempUnit: (id: string, patch: Partial<Pick<TempUnit, 'name' | 'type'>>) => void;
  deleteTempUnit: (id: string) => void;
  moveTempUnit: (id: string, dir: 'up' | 'down') => void;
  setWeekdayStatus: (weekday: number, status: DayServiceStatus) => void;
  setDayOverride: (date: number, status: DayServiceStatus) => void;
  removeDayOverride: (date: number) => void;
  addReception: (reception: Omit<ReceptionCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateReception: (id: string, reception: Partial<Omit<ReceptionCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteReception: (id: string) => void;
  addDailyRemark: (remark: Omit<DailyRemark, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateDailyRemark: (id: string, remark: Partial<Omit<DailyRemark, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteDailyRemark: (id: string) => void;
  addWitnessSample: (sample: Omit<WitnessSample, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>, options?: { timestamp?: number }) => void;
  updateWitnessSample: (id: string, sample: Partial<Omit<WitnessSample, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deleteWitnessSample: (id: string) => void;
  completeCleaningTask: (taskId: string) => void;
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
  tempLogs: [],
  cleaningTasks: [],
  oilChecks: [],
  fridgeTempChecks: [],
  fabrications: [],
  fabricationTypes: [],
  cleaningChecks: [],
  cleaningAreas: ['Restaurant / Salle', 'Cuisine / Stockage', 'Locaux communs'],
  closedWeekdays: [],
  singleServiceWeekdays: [],
  dayOverrides: [],
  receptions: [],
  dailyRemarks: [],
  witnessSamples: [],
  productUnits: ['kg', 'g', 'pce', 'L', 'broche', 'bacs'],
  customActionTypes: [],
  defaultActionTypeStates: [],
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
        return id;
      },

      updateProductStatus: (id, status, options) => {
        const usedAt = options?.usedAt;
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status,
                  ...(usedAt !== undefined ? { usedAt } : {}),
                  modifiedAt: Date.now(),
                  syncStatus: state.isOffline ? 'offline' : 'pending',
                }
              : p
          ),
        }));
      },

      updateProduct: (id, productData) => {
        set((state) => ({
          products: state.products.map((p) =>
            p.id === id ? { ...p, ...productData, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' } : p
          ),
        }));
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

      addCustomActionType: ({ label, dlcDays }) => {
        const id = randomId();
        const now = Date.now();
        set((state) => ({
          customActionTypes: [
            ...state.customActionTypes,
            { id, label: label.trim(), dlcDays, modifiedAt: now } as CustomActionType,
          ],
        }));
        return id;
      },

      // Soft-delete (tombstone) so the sync union-merge can propagate the
      // removal. Blocks only if an ACTIVE product still references this id —
      // historical entries (used / discarded / tombstoned) keep displaying via
      // getActionTypeDef which resolves even tombstoned customs.
      removeCustomActionType: (id) => {
        const inUseActive = get().products.some(
          (p) => p.actionType === id && p.status === 'active' && !p.deletedAt
        );
        if (inUseActive) {
          return { ok: false, error: "Des étiquettes actives utilisent encore ce type — change-les, marque-les utilisées ou jetées d'abord." };
        }
        const now = Date.now();
        set((state) => ({
          customActionTypes: state.customActionTypes.map((c) =>
            c.id === id ? { ...c, deletedAt: now, modifiedAt: now } : c
          ),
        }));
        return { ok: true };
      },

      setDefaultActionTypeDisabled: (id, disabled) => {
        const now = Date.now();
        set((state) => {
          const existing = state.defaultActionTypeStates.find((s) => s.id === id);
          if (existing) {
            return {
              defaultActionTypeStates: state.defaultActionTypeStates.map((s) =>
                s.id === id ? { ...s, disabled, modifiedAt: now } : s
              ),
            };
          }
          return {
            defaultActionTypeStates: [
              ...state.defaultActionTypeStates,
              { id, disabled, modifiedAt: now } as DefaultActionTypeState,
            ],
          };
        });
      },

      addTempLog: (log) => {
        const id = randomId();
        const timestamp = Date.now();
        set((state) => ({ tempLogs: [...state.tempLogs, { ...log, id, timestamp } as TemperatureLog] }));
      },

      // options.timestamp allows backfilling a missed day — the check lands on
      // that day while modifiedAt keeps the real entry time.
      addOilCheck: (check, options) => {
        const now = Date.now();
        set((state) => ({
          oilChecks: [...state.oilChecks, { ...check, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as OilCheck],
        }));
      },

      // Corrections only — the check's original timestamp is preserved so it
      // stays on its day; modifiedAt is bumped so the merge propagates the edit.
      updateOilCheck: (id, check) => set((state) => ({
        oilChecks: state.oilChecks.map((c) => (c.id === id ? { ...c, ...check, modifiedAt: Date.now() } : c)),
      })),

      deleteOilCheck: (id) => set((state) => ({
        oilChecks: state.oilChecks.map((c) => (c.id === id ? tomb(c) : c)),
      })),

      // Same shape as the oil check actions: options.timestamp backfills a
      // missed day, updates preserve the reading's timestamp.
      addFridgeTempCheck: (check, options) => {
        const now = Date.now();
        set((state) => ({
          fridgeTempChecks: [...state.fridgeTempChecks, { ...check, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as FridgeTempCheck],
        }));
      },

      updateFridgeTempCheck: (id, check) => set((state) => ({
        fridgeTempChecks: state.fridgeTempChecks.map((c) => (c.id === id ? { ...c, ...check, modifiedAt: Date.now() } : c)),
      })),

      deleteFridgeTempCheck: (id) => set((state) => ({
        fridgeTempChecks: state.fridgeTempChecks.map((c) => (c.id === id ? tomb(c) : c)),
      })),

      // Same lifecycle as the other register controls.
      addFabrication: (fab, options) => {
        const now = Date.now();
        set((state) => ({
          fabrications: [...state.fabrications, { ...fab, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as Fabrication],
        }));
      },

      updateFabrication: (id, fab) => set((state) => ({
        fabrications: state.fabrications.map((f) => (f.id === id ? { ...f, ...fab, modifiedAt: Date.now() } : f)),
      })),

      deleteFabrication: (id) => set((state) => ({
        fabrications: state.fabrications.map((f) => (f.id === id ? tomb(f) : f)),
      })),

      // Admin-defined fabrication types (schema-driven forms). Records
      // snapshot their labels at save time, so removing/editing a type never
      // breaks existing fabrications — no usage check needed.
      addFabricationType: ({ label, fields }) => {
        const id = randomId();
        set((state) => ({
          fabricationTypes: [...state.fabricationTypes, { id, label: label.trim(), fields, modifiedAt: Date.now() } as FabricationType],
        }));
        return id;
      },

      updateFabricationType: (id, data) => set((state) => ({
        fabricationTypes: state.fabricationTypes.map((t) => (t.id === id ? { ...t, ...data, modifiedAt: Date.now() } : t)),
      })),

      removeFabricationType: (id) => set((state) => ({
        fabricationTypes: state.fabricationTypes.map((t) => (t.id === id ? tomb(t) : t)),
      })),

      // Contrôles nettoyage — same lifecycle as the other register controls.
      addCleaningCheck: (check, options) => {
        const now = Date.now();
        set((state) => ({
          cleaningChecks: [...state.cleaningChecks, { ...check, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as CleaningCheck],
        }));
      },

      updateCleaningCheck: (id, check) => set((state) => ({
        cleaningChecks: state.cleaningChecks.map((c) => (c.id === id ? { ...c, ...check, modifiedAt: Date.now() } : c)),
      })),

      deleteCleaningCheck: (id) => set((state) => ({
        cleaningChecks: state.cleaningChecks.map((c) => (c.id === id ? tomb(c) : c)),
      })),

      // Cleaning zones are a plain label list like productUnits — records
      // snapshot the label, so removing a zone never breaks history.
      addCleaningArea: (name) => set((state) => {
        const trimmed = name.trim();
        if (!trimmed || state.cleaningAreas.includes(trimmed)) return {};
        return { cleaningAreas: [...state.cleaningAreas, trimmed] };
      }),

      deleteCleaningArea: (name) => set((state) => ({
        cleaningAreas: state.cleaningAreas.filter((a) => a !== name),
      })),

      // Enceintes du relevé de température — modèle entité (id + modifiedAt +
      // tombstone) pour que renommages/suppressions se propagent entre appareils.
      // Premier édit : on fige la liste depuis la structure (`deriveColdUnits`),
      // ensuite elle est indépendante. Ids réutilisés → historique préservé.
      addTempUnit: (name, type) => set((state) => {
        const trimmed = name.trim();
        if (!trimmed) return {};
        const base = state.tempUnits ?? deriveColdUnits(state.storageUnits);
        return { tempUnits: [...base, { id: randomId(), name: trimmed, type, modifiedAt: Date.now() }] };
      }),

      updateTempUnit: (id, patch) => set((state) => {
        const base = state.tempUnits ?? deriveColdUnits(state.storageUnits);
        return {
          tempUnits: base.map((u) => (u.id === id
            ? { ...u, ...patch, ...(patch.name !== undefined ? { name: patch.name.trim() } : {}), modifiedAt: Date.now() }
            : u)),
        };
      }),

      deleteTempUnit: (id) => set((state) => {
        const base = state.tempUnits ?? deriveColdUnits(state.storageUnits);
        return { tempUnits: base.map((u) => (u.id === id ? tomb(u) : u)) };
      }),

      // Réordonne l'ordre de saisie (le "chemin habituel" du relevé). On échange
      // la position de deux enceintes vivantes voisines ; les tombstones gardent
      // leur place (filtrées à la lecture). L'ordre = ordre du tableau.
      moveTempUnit: (id, dir) => set((state) => {
        const base = (state.tempUnits ?? deriveColdUnits(state.storageUnits)).slice();
        const live = base.map((u, i) => ({ u, i })).filter((x) => !x.u.deletedAt);
        const pos = live.findIndex((x) => x.u.id === id);
        if (pos < 0) return {};
        const target = dir === 'up' ? pos - 1 : pos + 1;
        if (target < 0 || target >= live.length) return {};
        const a = live[pos].i, b = live[target].i;
        [base[a], base[b]] = [base[b], base[a]];
        return { tempUnits: base };
      }),

      // Planning hebdomadaire — un jour est ouvert / unique / fermé. Les deux
      // listes restent mutuellement exclusives. Local-authoritative (voir applyCloudState).
      setWeekdayStatus: (weekday, status) => set((state) => {
        const closed = (state.closedWeekdays ?? []).filter((d) => d !== weekday);
        const single = (state.singleServiceWeekdays ?? []).filter((d) => d !== weekday);
        if (status === 'closed') closed.push(weekday);
        else if (status === 'single') single.push(weekday);
        return {
          closedWeekdays: closed.sort((a, b) => a - b),
          singleServiceWeekdays: single.sort((a, b) => a - b),
        };
      }),

      // Exception ponctuelle sur une date — upsert par début de journée (id
      // déterministe), fusion newer-wins entre appareils. 'open' garde une
      // exception explicite (ex. ouverture exceptionnelle un jour normalement fermé).
      setDayOverride: (date, status) => set((state) => {
        const d0 = startOfDayMs(date);
        const id = dayOverrideId(d0);
        const now = Date.now();
        const rest = (state.dayOverrides ?? []).filter((o) => o.id !== id);
        return { dayOverrides: [...rest, { id, date: d0, status, modifiedAt: now } as DayOverride] };
      }),

      removeDayOverride: (date) => set((state) => {
        const id = dayOverrideId(date);
        return { dayOverrides: (state.dayOverrides ?? []).map((o) => (o.id === id ? tomb(o) : o)) };
      }),

      // Réceptions — same lifecycle as the other register controls.
      addReception: (reception, options) => {
        const now = Date.now();
        set((state) => ({
          receptions: [...state.receptions, { ...reception, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as ReceptionCheck],
        }));
      },

      updateReception: (id, reception) => set((state) => ({
        receptions: state.receptions.map((r) => (r.id === id ? { ...r, ...reception, modifiedAt: Date.now() } : r)),
      })),

      deleteReception: (id) => set((state) => ({
        receptions: state.receptions.map((r) => (r.id === id ? tomb(r) : r)),
      })),

      // Remarques de la journée & plats témoins — same lifecycle as the
      // other register controls.
      addDailyRemark: (remark, options) => {
        const now = Date.now();
        set((state) => ({
          dailyRemarks: [...state.dailyRemarks, { ...remark, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as DailyRemark],
        }));
      },

      updateDailyRemark: (id, remark) => set((state) => ({
        dailyRemarks: state.dailyRemarks.map((r) => (r.id === id ? { ...r, ...remark, modifiedAt: Date.now() } : r)),
      })),

      deleteDailyRemark: (id) => set((state) => ({
        dailyRemarks: state.dailyRemarks.map((r) => (r.id === id ? tomb(r) : r)),
      })),

      addWitnessSample: (sample, options) => {
        const now = Date.now();
        set((state) => ({
          witnessSamples: [...state.witnessSamples, { ...sample, id: randomId(), timestamp: options?.timestamp ?? now, recordedAt: now, modifiedAt: now } as WitnessSample],
        }));
      },

      updateWitnessSample: (id, sample) => set((state) => ({
        witnessSamples: state.witnessSamples.map((s) => (s.id === id ? { ...s, ...sample, modifiedAt: Date.now() } : s)),
      })),

      deleteWitnessSample: (id) => set((state) => ({
        witnessSamples: state.witnessSamples.map((s) => (s.id === id ? tomb(s) : s)),
      })),

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
          // tempLogs is append-only history; no modifiedAt, just dedupe by id.
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
            // Garde `undefined` (= reflète la structure) tant que le cloud n'a pas
            // de liste figée ; sinon fusion newer-wins comme les autres entités.
            tempUnits: cloud.tempUnits !== undefined
              ? mergeNewer(state.tempUnits ?? [], cloud.tempUnits)
              : state.tempUnits,
            shelves: mergeNewer(state.shelves, cloud.shelves),
            bacs: mergeNewer(state.bacs, cloud.bacs),
            products: mergeNewer(state.products, cloud.products),
            tempLogs: mergeAppendOnly(state.tempLogs, cloud.tempLogs),
            cleaningTasks: mergeNewer(state.cleaningTasks, cloud.cleaningTasks),
            oilChecks: mergeNewer(state.oilChecks, cloud.oilChecks),
            fridgeTempChecks: mergeNewer(state.fridgeTempChecks, cloud.fridgeTempChecks),
            fabrications: mergeNewer(state.fabrications, cloud.fabrications),
            fabricationTypes: mergeNewer(state.fabricationTypes, cloud.fabricationTypes),
            cleaningChecks: mergeNewer(state.cleaningChecks, cloud.cleaningChecks),
            receptions: mergeNewer(state.receptions, cloud.receptions),
            dailyRemarks: mergeNewer(state.dailyRemarks, cloud.dailyRemarks),
            witnessSamples: mergeNewer(state.witnessSamples, cloud.witnessSamples),
            cleaningAreas: Array.from(new Set([...(state.cleaningAreas ?? []), ...((cloud.cleaningAreas as string[]) ?? [])])),
            // Restaurant config — local wins once set; a fresh device picks up the cloud value.
            closedWeekdays: (state.closedWeekdays && state.closedWeekdays.length)
              ? state.closedWeekdays
              : ((cloud.closedWeekdays as number[]) ?? []),
            singleServiceWeekdays: (state.singleServiceWeekdays && state.singleServiceWeekdays.length)
              ? state.singleServiceWeekdays
              : ((cloud.singleServiceWeekdays as number[]) ?? []),
            // Per-date exceptions are real records (id + modifiedAt + tombstone) → newer-wins merge.
            dayOverrides: mergeNewer(state.dayOverrides ?? [], cloud.dayOverrides),
            productUnits: Array.from(new Set([...(state.productUnits ?? []), ...((cloud.productUnits as string[]) ?? [])])),
            customActionTypes: mergeNewer(state.customActionTypes, cloud.customActionTypes),
            defaultActionTypeStates: mergeNewer(state.defaultActionTypeStates as any, cloud.defaultActionTypeStates as any),
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
        tempUnits: state.tempUnits,
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
