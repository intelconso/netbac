import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState, Bac, Product, User, Zone, StorageUnit, Shelf, ActivityLog, TemperatureLog, CleaningTask } from '../types';

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
  addTempLog: (log: Omit<TemperatureLog, 'id' | 'timestamp'>) => void;
  completeCleaningTask: (taskId: string) => void;
  addLog: (log: Omit<ActivityLog, 'id' | 'timestamp' | 'userId' | 'userName'>) => void;
  setUser: (user: User | null) => void;
  updateSettings: (settings: Partial<User['settings']>) => void;
  setOffline: (isOffline: boolean) => void;
}

export const useStore = create<AppState & StoreActions>()(
  persist(
    (set, get) => ({
      zones: [
        { id: 'z1', name: 'Cuisine', icon: '👨‍🍳' },
        { id: 'z2', name: 'Bar', icon: '🍸' },
        { id: 'z3', name: 'Réserve', icon: '📦' },
      ],
      storageUnits: [
        { id: 'u1', zoneId: 'z1', name: 'Frigo 1', type: 'frigo', icon: '❄️' },
        { id: 'u2', zoneId: 'z1', name: 'Frigo 2', type: 'frigo', icon: '❄️' },
        { id: 'u3', zoneId: 'z3', name: 'Étagère Sèche', type: 'reserve', icon: '🥫' },
      ],
      shelves: [
        { id: 's1', unitId: 'u1', level: 1, name: 'Niveau Haut' },
        { id: 's2', unitId: 'u1', level: 2, name: 'Niveau Milieu' },
        { id: 's3', unitId: 'u1', level: 3, name: 'Niveau Bas' },
      ],
      bacs: [
        { id: '1', shelfId: 's1', name: 'POULET', type: 'bac', color: '#10B981', icon: '🍗', createdAt: Date.now(), syncStatus: 'synced' },
        { id: '2', shelfId: 's2', name: 'POISSON', type: 'bac', color: '#3B82F6', icon: '🐟', createdAt: Date.now(), syncStatus: 'synced' },
        { id: '3', shelfId: 's3', name: 'LÉGUMES', type: 'boite', color: '#84CC16', icon: '🥬', createdAt: Date.now(), syncStatus: 'synced' },
      ],
      products: [],
      logs: [],
      tempLogs: [],
      cleaningTasks: [
        { id: 'c1', unitId: 'u1', name: 'Nettoyage intérieur', frequency: 'weekly', nextDue: Date.now() },
        { id: 'c2', unitId: 'u2', name: 'Nettoyage intérieur', frequency: 'weekly', nextDue: Date.now() },
      ],
      user: {
        id: 'user-1',
        name: 'Mohamed YAHI',
        restaurantName: 'Digital Pro',
        isPro: true,
        settings: {
          enableTemperature: true,
          enableCleaning: true,
          simplifiedMode: false,
        }
      },
      isOffline: false,

      addZone: (zone) => set((state) => ({
        zones: [...state.zones, { ...zone, id: crypto.randomUUID() }]
      })),

      deleteZone: (id) => set((state) => ({
        zones: state.zones.filter(z => z.id !== id),
        storageUnits: state.storageUnits.filter(u => u.zoneId !== id)
      })),

      addStorageUnit: (unit) => set((state) => ({
        storageUnits: [...state.storageUnits, { ...unit, id: crypto.randomUUID() }]
      })),

      updateStorageUnit: (id, unit) => set((state) => ({
        storageUnits: state.storageUnits.map(u => u.id === id ? { ...u, ...unit } : u)
      })),

      deleteStorageUnit: (id) => set((state) => ({
        storageUnits: state.storageUnits.filter(u => u.id !== id),
        shelves: state.shelves.filter(s => s.unitId !== id)
      })),

      addShelf: (shelf) => set((state) => ({
        shelves: [...state.shelves, { ...shelf, id: crypto.randomUUID() }]
      })),

      updateShelf: (id, shelf) => set((state) => ({
        shelves: state.shelves.map(s => s.id === id ? { ...s, ...shelf } : s)
      })),

      deleteShelf: (id) => set((state) => ({
        shelves: state.shelves.filter(s => s.id !== id),
        bacs: state.bacs.filter(b => b.shelfId !== id)
      })),

      setUnitShelves: (unitId, count) => set((state) => {
        const existingShelves = state.shelves.filter(s => s.unitId === unitId);
        const otherShelves = state.shelves.filter(s => s.unitId !== unitId);
        
        const newShelves = Array.from({ length: count }, (_, i) => {
          const level = i + 1;
          const existing = existingShelves.find(s => s.level === level);
          return existing || {
            id: crypto.randomUUID(),
            unitId,
            level,
            name: `Niveau ${level}`
          };
        });

        return {
          shelves: [...otherShelves, ...newShelves].sort((a, b) => a.level - b.level)
        };
      }),

      addBac: (bac) => set((state) => ({
        bacs: [...state.bacs, {
          ...bac,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          syncStatus: state.isOffline ? 'offline' : 'pending'
        }]
      })),

      updateBac: (id, bac) => set((state) => ({
        bacs: state.bacs.map(b => b.id === id ? { ...b, ...bac } : b)
      })),

      deleteBac: (id) => set((state) => ({
        bacs: state.bacs.filter(b => b.id !== id),
        products: state.products.filter(p => p.bacId !== id)
      })),

      addProduct: (product) => {
        const id = crypto.randomUUID();
        set((state) => ({
          products: [...state.products, {
            ...product,
            id,
            addedAt: Date.now(),
            modifiedAt: Date.now(),
            status: 'active',
            syncStatus: state.isOffline ? 'offline' : 'pending'
          }]
        }));
        get().addLog({
          action: 'add_product',
          details: `Ajout du produit: ${product.name}`,
          entityId: id
        });
        return id;
      },

      updateProductStatus: (id, status) => {
        const product = get().products.find(p => p.id === id);
        set((state) => ({
          products: state.products.map(p => 
            p.id === id ? { ...p, status, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' } : p
          )
        }));
        if (product) {
          get().addLog({
            action: status === 'used' ? 'use_product' : 'discard_product',
            details: `${status === 'used' ? 'Utilisation' : 'Mise au rebut'} de: ${product.name}`,
            entityId: id
          });
        }
      },

      updateProduct: (id, productData) => {
        const product = get().products.find(p => p.id === id);
        set((state) => ({
          products: state.products.map(p => 
            p.id === id ? { ...p, ...productData, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' } : p
          )
        }));
        if (product) {
          get().addLog({
            action: 'update_product',
            details: `Mise à jour du produit: ${product.name}`,
            entityId: id
          });
        }
      },

      deleteProduct: (id) => set((state) => ({
        products: state.products.filter(p => p.id !== id)
      })),

      addTempLog: (log) => {
        const id = crypto.randomUUID();
        const timestamp = Date.now();
        const unitName = get().storageUnits.find(u => u.id === log.unitId)?.name || 'Unité inconnue';
        
        set((state) => ({
          tempLogs: [...state.tempLogs, { ...log, id, timestamp } as TemperatureLog]
        }));
        
        get().addLog({
          action: 'temp_check',
          details: `Relevé de température: ${log.temperature}°C pour ${unitName}`,
          entityId: id
        });
      },

      completeCleaningTask: (taskId) => {
        const now = Date.now();
        const task = get().cleaningTasks.find(t => t.id === taskId);
        if (!task) return;

        let nextDue = now;
        if (task.frequency === 'daily') nextDue += 24 * 60 * 60 * 1000;
        else if (task.frequency === 'weekly') nextDue += 7 * 24 * 60 * 60 * 1000;
        else if (task.frequency === 'monthly') nextDue += 30 * 24 * 60 * 60 * 1000;

        set((state) => ({
          cleaningTasks: state.cleaningTasks.map(t => 
            t.id === taskId ? { ...t, lastDone: now, nextDue } : t
          )
        }));
        get().addLog({
          action: 'cleaning',
          details: `Nettoyage effectué: ${task.name}`,
          entityId: taskId
        });
      },

      addLog: (log) => {
        const user = get().user;
        set((state) => ({
          logs: [{
            ...log,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            userId: user?.id || 'unknown',
            userName: user?.name || 'Inconnu'
          } as ActivityLog, ...state.logs].slice(0, 100) // Keep last 100 logs
        }));
      },

      setUser: (user) => set({ 
        user: user ? {
          ...user,
          settings: {
            enableTemperature: true,
            enableCleaning: true,
            simplifiedMode: false,
            ...user.settings
          }
        } : null 
      }),
      updateSettings: (newSettings) => set((state) => ({
        user: state.user ? {
          ...state.user,
          settings: { ...state.user.settings, ...newSettings }
        } : null
      })),
      setOffline: (isOffline) => set({ isOffline }),
    }),
    {
      name: 'netbac-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
