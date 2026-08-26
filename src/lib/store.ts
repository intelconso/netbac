import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, ActionType, Article, ArticleCategory, Bac, CleaningCheck, CustomActionType, DailyRemark, DayOverride, DayServiceStatus, DefaultActionTypeState, Fabrication, FabricationField, FabricationType, FridgeTempCheck, OilCheck, PestCadence, PestControlCheck, PestStation, Product, ReceptionCheck, StockMovement, StockMovementKind, TempUnit, User, WitnessSample, Zone, StorageUnit, Shelf, TemperatureLog, CleaningTask, Employee, ServiceSlot, Task, TaskCompletion, Supplier, ShoppingItem, ShoppingEntry } from '../types';
import { randomId } from './utils';
import { deriveColdUnits } from './tempUnits';
import { nextCheckFrom } from './pestControl';
import { dayOverrideId, startOfDayMs } from './serviceDays';
import { taskCompletionId } from './tasks';
import {
  DEFAULT_SHOPPING_ITEMS,
  DEFAULT_SUPPLIERS,
  findShoppingItem,
  findSupplier,
} from './shopping';
import {
  DEFAULT_ARTICLE_CATEGORIES,
  convertQty,
  createsStockIn,
  deducedLocationOf,
  findArticleByName,
  findCategoryByName,
  movementId,
  normalizeArticleName,
  roundQty,
  stockByArticle,
} from './inventory';

// Rangement d'un article dans la structure — voir Article dans types.ts.
// Les quatre niveaux voyagent ensemble : choisir une étagère renseigne aussi
// son enceinte et sa zone, choisir une zone efface les niveaux plus profonds.
type ArticleLocation = Pick<Article, 'zoneId' | 'unitId' | 'shelfId' | 'bacId'>;

const pickLocation = (l: Partial<ArticleLocation>): Partial<ArticleLocation> => ({
  ...(l.zoneId ? { zoneId: l.zoneId } : {}),
  ...(l.unitId ? { unitId: l.unitId } : {}),
  ...(l.shelfId ? { shelfId: l.shelfId } : {}),
  ...(l.bacId ? { bacId: l.bacId } : {}),
});

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
  addBac: (bac: Omit<Bac, 'id' | 'createdAt' | 'modifiedAt' | 'syncStatus'>) => string;
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
  addPestControlCheck: (check: Omit<PestControlCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt' | 'nextCheck'>, options?: { timestamp?: number; nextCheck?: number }) => void;
  updatePestControlCheck: (id: string, check: Partial<Omit<PestControlCheck, 'id' | 'timestamp' | 'recordedAt' | 'modifiedAt'>>) => void;
  deletePestControlCheck: (id: string) => void;
  addPestStation: (station: { number: string; zone: string }) => void;
  deletePestStation: (id: string) => void;
  setPestCadence: (cadence: PestCadence) => void;
  addEmployee: (data: { name: string; role?: string }) => void;
  updateEmployee: (id: string, patch: Partial<Pick<Employee, 'name' | 'role'>>) => void;
  deleteEmployee: (id: string) => void;
  addTask: (data: Omit<Task, 'id' | 'order' | 'modifiedAt' | 'deletedAt'>) => void;
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'order' | 'modifiedAt'>>) => void;
  deleteTask: (id: string) => void;
  moveTask: (id: string, dir: 'up' | 'down') => void;
  completeTask: (taskId: string, data: { employeeId?: string; operatorName: string; notes?: string }, options?: { dayKey?: number; service?: ServiceSlot }) => void;
  uncompleteTask: (taskId: string, dayKey?: number, service?: ServiceSlot) => void;
  addTaskPhoto: (data: { taskId: string; dayKey?: number; service?: ServiceSlot; employeeId?: string; operatorName: string }) => string;
  setTaskPhotoUrl: (id: string, url: string) => void;
  setTaskReminderHour: (hour: number | undefined) => void;
  addArticle: (data: { name: string; unit: string; minQty?: number; categoryId?: string } & ArticleLocation) => string;
  updateArticle: (id: string, patch: Partial<Pick<Article, 'name' | 'unit' | 'minQty' | 'categoryId'> & ArticleLocation>) => { ok: boolean; error?: string };
  deleteArticle: (id: string) => void;
  addArticleCategory: (data: { name: string; color?: string }) => { ok: boolean; id?: string; error?: string };
  updateArticleCategory: (id: string, patch: { name?: string; color?: string }) => { ok: boolean; error?: string };
  deleteArticleCategory: (id: string) => void;
  restoreDefaultArticleCategories: () => number;
  // Liste de courses — catalogue séparé de l'inventaire (voir shopping.ts).
  addSupplier: (data: { name: string; note?: string }) => { ok: boolean; id?: string; error?: string };
  updateSupplier: (id: string, patch: { name?: string; note?: string }) => { ok: boolean; error?: string };
  deleteSupplier: (id: string) => void;
  addShoppingItem: (data: { name: string; supplierId?: string }) => { ok: boolean; id?: string; error?: string };
  updateShoppingItem: (id: string, patch: { name?: string; supplierId?: string | null }) => { ok: boolean; error?: string };
  deleteShoppingItem: (id: string) => void;
  setShoppingQty: (itemId: string, qty: number) => void;
  addShoppingExtra: (data: { name: string; supplierId?: string; qty?: number }) => { ok: boolean; id?: string; error?: string };
  removeShoppingExtra: (id: string) => void;
  clearShoppingList: () => number;
  restoreDefaultShoppingCatalog: () => number;
  importArticlesFromProducts: () => { created: number; linked: number };
  autoAssignArticleLocations: (options?: { includeZoneOnly?: boolean }) => { placed: number; remaining: number };
  addStockMovement: (data: { articleId: string; kind: StockMovementKind; qty: number; timestamp?: number; operatorName?: string; notes?: string }) => void;
  setStockCount: (articleId: string, countedQty: number, data?: { operatorName?: string; notes?: string }) => void;
  deleteStockMovement: (id: string) => { ok: boolean; error?: string };
  setUser: (user: User | null) => void;
  updateSettings: (settings: Partial<User['settings']>) => void;
  setOffline: (isOffline: boolean) => void;
  enqueuePendingPhoto: (productId: string, localPath: string) => void;
  removePendingPhoto: (productId: string) => void;
  enqueueTaskPhotoUpload: (taskPhotoId: string, localPath: string) => void;
  removeTaskPhotoUpload: (taskPhotoId: string) => void;
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
  pestControlChecks: [],
  pestStations: [],
  pestCadence: undefined,
  closedWeekdays: [],
  singleServiceWeekdays: [],
  dayOverrides: [],
  receptions: [],
  dailyRemarks: [],
  witnessSamples: [],
  employees: [],
  tasks: [],
  taskCompletions: [],
  taskPhotos: [],
  taskReminderHour: undefined,
  productUnits: ['kg', 'g', 'pce', 'L', 'broche', 'bacs'],
  articles: [],
  stockMovements: [],
  // Catégories proposées d'origine, ids fixes — voir DEFAULT_ARTICLE_CATEGORIES.
  articleCategories: DEFAULT_ARTICLE_CATEGORIES.map((c) => ({ ...c, modifiedAt: 0 })),
  // Catalogue de courses d'origine, ids fixes et `modifiedAt: 0` — même
  // raisonnement que les catégories ci-dessus : la graine perd contre toute
  // vraie modification venue du cloud, y compris une suppression.
  suppliers: DEFAULT_SUPPLIERS.map((s, i) => ({ ...s, order: i, modifiedAt: 0 })),
  shoppingItems: DEFAULT_SHOPPING_ITEMS.map((i) => ({ ...i, modifiedAt: 0 })),
  shoppingEntries: [],
  customActionTypes: [],
  defaultActionTypeStates: [],
  user: null,
  isOffline: false,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
  lastSyncError: null,
  pendingPhotos: [],
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

// Remet à zéro les quantités de courses visées, sans supprimer les
// enregistrements : voir setShoppingQty — une ligne physiquement retirée
// ressusciterait à la première fusion, une ligne à 0 gagne au dernier-écrit.
// Une ligne libre (`name`) n'existe que par son entrée : elle, on l'enterre.
function zeroEntries(entries: ShoppingEntry[], doomed: (e: ShoppingEntry) => boolean): ShoppingEntry[] {
  const now = Date.now();
  return entries.map((e) => {
    if (e.deletedAt || !doomed(e)) return e;
    return e.name ? { ...e, qty: 0, modifiedAt: now, deletedAt: now } : { ...e, qty: 0, modifiedAt: now };
  });
}

// Aligne le registre de stock sur une étiquette.
//
// Un mouvement né d'une étiquette n'est JAMAIS écrit à la main depuis un écran :
// il est dérivé de l'étiquette, ici. Cette fonction recalcule l'ensemble exact
// des mouvements que l'étiquette doit produire dans son état actuel, puis aligne
// le registre dessus — création, mise à jour, résurrection, mise en tombstone.
//
// Toutes les actions produit passent par elle (ajout, édition, changement de
// statut, suppression), donc l'étiquette et le stock ne peuvent pas diverger :
// corriger une quantité, changer d'article ou supprimer une étiquette corrige
// le stock du même geste, sans que l'appelant ait à y penser.
//
// Les ids sont déterministes (voir movementId) : deux appareils hors ligne qui
// marquent la même étiquette utilisée convergent sur UN mouvement au lieu de
// sortir la quantité deux fois à la fusion.
function reconcileProductMovements(
  product: Product,
  articles: Article[],
  movements: StockMovement[]
): StockMovement[] {
  const now = Date.now();
  const article = product.articleId
    ? articles.find((a) => a.id === product.articleId && !a.deletedAt)
    : undefined;

  // Ce que l'étiquette doit produire dans son état actuel. Une étiquette sans
  // article rattaché (les anciennes, et le texte libre) ne bouge aucun stock.
  const wanted = new Map<string, { kind: StockMovementKind; timestamp?: number }>();
  if (article && !product.deletedAt && product.quantity > 0) {
    const add = (kind: StockMovementKind, timestamp?: number) =>
      wanted.set(movementId(product.id, kind), { kind, timestamp });
    if (createsStockIn(product.actionType)) add('in', product.addedAt);
    if (product.status === 'used') add('out_used', product.usedAt);
    if (product.status === 'discarded') add('out_waste');
  }

  const next = movements.map((m) => {
    if (m.productId !== product.id) return m;
    const want = wanted.get(m.id);
    // Plus attendu : on pose une tombstone plutôt que de retirer la ligne, pour
    // que la fusion propage le retrait aux autres appareils.
    if (!want) return m.deletedAt ? m : { ...m, deletedAt: now, modifiedAt: now };
    wanted.delete(m.id);
    return {
      ...m,
      articleId: article!.id,
      articleName: article!.name,
      unit: product.unit,
      qty: product.quantity,
      // On garde l'horodatage d'origine : éditer une note sur une étiquette déjà
      // utilisée ne doit pas déplacer la sortie dans le temps. Une date d'usage
      // rétroactive, elle, prime — c'est justement ce qu'elle veut dire.
      timestamp: want.timestamp ?? m.timestamp,
      deletedAt: undefined,
      modifiedAt: now,
    };
  });

  for (const [id, want] of wanted) {
    next.push({
      id,
      articleId: article!.id,
      articleName: article!.name,
      unit: product.unit,
      kind: want.kind,
      qty: product.quantity,
      timestamp: want.timestamp ?? now,
      productId: product.id,
      modifiedAt: now,
    });
  }
  return next;
}

// Supprimer un emplacement supprime les étiquettes qu'il contient — et donc
// leur stock. Sans le reconcile, l'entrée d'une étiquette active resterait au
// registre alors que l'étiquette n'existe plus : l'article garderait une
// quantité fantôme que rien à l'écran ne permettrait plus de corriger.
//
// Les étiquettes déjà supprimées sont laissées telles quelles : les
// retombstoner ne changerait rien au stock mais réécrirait leur `modifiedAt`,
// donc les ferait ressortir à chaque fusion.
function tombProductsWhere(
  state: { products: Product[]; articles: Article[]; stockMovements: StockMovement[] },
  doomed: (product: Product) => boolean
): { products: Product[]; stockMovements: StockMovement[] } {
  let stockMovements = state.stockMovements;
  const products = state.products.map((p) => {
    if (p.deletedAt || !doomed(p)) return p;
    const touched = tomb(p);
    stockMovements = reconcileProductMovements(touched, state.articles, stockMovements);
    return touched;
  });
  return { products, stockMovements };
}

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
          ...tombProductsWhere(state, (p) => childBacIds.includes(p.bacId)),
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
          ...tombProductsWhere(state, (p) => childBacIds.includes(p.bacId)),
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
          ...tombProductsWhere(state, (p) => childBacIds.includes(p.bacId)),
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
          ...tombProductsWhere(state, (p) => removedBacIds.has(p.bacId)),
        };
      }),

      // Rend l'id : créer un contenant depuis le formulaire d'étiquette doit
      // pouvoir le sélectionner dans la foulée, sans le rechercher par nom.
      addBac: (bac) => {
        const id = randomId();
        set((state) => ({
          bacs: [...state.bacs, {
            ...bac,
            id,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
            syncStatus: state.isOffline ? 'offline' : 'pending',
          }],
        }));
        return id;
      },

      updateBac: (id, bac) => set((state) => ({
        bacs: state.bacs.map((b) => (b.id === id ? { ...b, ...bac, modifiedAt: Date.now() } : b)),
      })),

      deleteBac: (id) => set((state) => ({
        bacs: state.bacs.map((b) => (b.id === id ? tomb(b) : b)),
        ...tombProductsWhere(state, (p) => p.bacId === id),
      })),

      // Les trois mutations d'étiquette ci-dessous rejouent
      // reconcileProductMovements sur l'étiquette touchée : c'est ce qui fait
      // que le stock suit les étiquettes sans qu'aucun écran n'ait à le savoir.
      // Marquer utilisé depuis la liste, depuis un bac ou depuis le jeté en
      // masse des alertes passe par updateProductStatus — donc par ici.
      addProduct: (product) => {
        const id = randomId();
        set((state) => {
          const created: Product = {
            ...product,
            id,
            addedAt: Date.now(),
            modifiedAt: Date.now(),
            status: 'active',
            syncStatus: state.isOffline ? 'offline' : 'pending',
          };
          return {
            products: [...state.products, created],
            stockMovements: reconcileProductMovements(created, state.articles, state.stockMovements),
          };
        });
        return id;
      },

      updateProductStatus: (id, status, options) => {
        const usedAt = options?.usedAt;
        set((state) => {
          let touched: Product | undefined;
          const products = state.products.map((p) => {
            if (p.id !== id) return p;
            touched = {
              ...p,
              status,
              ...(usedAt !== undefined ? { usedAt } : {}),
              modifiedAt: Date.now(),
              syncStatus: state.isOffline ? 'offline' : 'pending',
            };
            return touched;
          });
          if (!touched) return { products };
          return {
            products,
            stockMovements: reconcileProductMovements(touched, state.articles, state.stockMovements),
          };
        });
      },

      updateProduct: (id, productData) => {
        set((state) => {
          let touched: Product | undefined;
          const products = state.products.map((p) => {
            if (p.id !== id) return p;
            touched = { ...p, ...productData, modifiedAt: Date.now(), syncStatus: state.isOffline ? 'offline' : 'pending' };
            return touched;
          });
          if (!touched) return { products };
          return {
            products,
            stockMovements: reconcileProductMovements(touched, state.articles, state.stockMovements),
          };
        });
      },

      deleteProduct: (id) => set((state) => {
        let touched: Product | undefined;
        const products = state.products.map((p) => {
          if (p.id !== id) return p;
          touched = tomb(p);
          return touched;
        });
        if (!touched) return { products };
        return {
          products,
          stockMovements: reconcileProductMovements(touched, state.articles, state.stockMovements),
        };
      }),

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

      // Lutte contre les nuisibles — passage périodique. `nextCheck` est
      // pré-calculé depuis la cadence (modifiable via options) ; sinon même
      // cycle de vie que les autres contrôles du registre (backfill, tombstone).
      addPestControlCheck: (check, options) => {
        const now = Date.now();
        set((state) => {
          const timestamp = options?.timestamp ?? now;
          const nextCheck = options?.nextCheck ?? nextCheckFrom(timestamp, state.pestCadence);
          return {
            pestControlChecks: [...state.pestControlChecks, { ...check, id: randomId(), timestamp, nextCheck, recordedAt: now, modifiedAt: now } as PestControlCheck],
          };
        });
      },

      updatePestControlCheck: (id, check) => set((state) => ({
        pestControlChecks: state.pestControlChecks.map((c) => (c.id === id ? { ...c, ...check, modifiedAt: Date.now() } : c)),
      })),

      deletePestControlCheck: (id) => set((state) => ({
        pestControlChecks: state.pestControlChecks.map((c) => (c.id === id ? tomb(c) : c)),
      })),

      // Stations du plan — entités (id + modifiedAt + tombstone) pour propager
      // ajouts/suppressions entre appareils. Les passages référencent les n°
      // librement (texte), donc supprimer une station ne casse pas l'historique.
      addPestStation: ({ number, zone }) => set((state) => {
        const n = number.trim();
        const z = zone.trim();
        if (!n && !z) return {};
        return { pestStations: [...state.pestStations, { id: randomId(), number: n, zone: z, modifiedAt: Date.now() }] };
      }),

      deletePestStation: (id) => set((state) => ({
        pestStations: state.pestStations.map((s) => (s.id === id ? tomb(s) : s)),
      })),

      setPestCadence: (cadence) => set({ pestCadence: cadence }),

      // --- Checklist d'équipe ------------------------------------------------

      addEmployee: ({ name, role }) => set((state) => {
        const n = name.trim();
        if (!n) return {};
        const r = role?.trim();
        return {
          employees: [
            ...state.employees,
            { id: randomId(), name: n, ...(r ? { role: r } : {}), modifiedAt: Date.now() },
          ],
        };
      }),

      updateEmployee: (id, patch) => set((state) => ({
        employees: state.employees.map((e) => (e.id === id
          ? {
              ...e,
              ...patch,
              ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
              ...(patch.role !== undefined ? { role: patch.role.trim() } : {}),
              modifiedAt: Date.now(),
            }
          : e)),
      })),

      // Les cochages passés gardent leur snapshot `operatorName` : supprimer un
      // employé ne retire jamais son nom de l'historique.
      deleteEmployee: (id) => set((state) => ({
        employees: state.employees.map((e) => (e.id === id ? tomb(e) : e)),
      })),

      addTask: (data) => set((state) => {
        const label = data.label.trim();
        if (!label) return {};
        const order = state.tasks.reduce((max, t) => Math.max(max, t.order ?? 0), -1) + 1;
        return {
          tasks: [...state.tasks, { ...data, label, id: randomId(), order, modifiedAt: Date.now() }],
        };
      }),

      updateTask: (id, patch) => set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id
          ? { ...t, ...patch, ...(patch.label !== undefined ? { label: patch.label.trim() } : {}), modifiedAt: Date.now() }
          : t)),
      })),

      deleteTask: (id) => set((state) => ({
        tasks: state.tasks.map((t) => (t.id === id ? tomb(t) : t)),
      })),

      // Réordonne la checklist. `order` est renuméroté sur les tâches vivantes
      // après échange — les tombstones gardent le leur, elles sont filtrées à
      // la lecture de toute façon.
      moveTask: (id, dir) => set((state) => {
        const live = state.tasks.filter((t) => !t.deletedAt).sort((a, b) => a.order - b.order);
        const pos = live.findIndex((t) => t.id === id);
        if (pos < 0) return {};
        const target = dir === 'up' ? pos - 1 : pos + 1;
        if (target < 0 || target >= live.length) return {};
        [live[pos], live[target]] = [live[target], live[pos]];
        const now = Date.now();
        const orders = new Map(live.map((t, i) => [t.id, i]));
        return {
          tasks: state.tasks.map((t) => (orders.has(t.id)
            ? { ...t, order: orders.get(t.id)!, modifiedAt: now }
            : t)),
        };
      }),

      // Upsert sur l'id déterministe : recocher après avoir décoché réveille le
      // même enregistrement (deletedAt effacé) plutôt que d'en créer un second.
      completeTask: (taskId, data, options) => set((state) => {
        const task = state.tasks.find((t) => t.id === taskId);
        if (!task) return {};
        const dayKey = startOfDayMs(options?.dayKey ?? Date.now());
        // Le service n'est porté que par une tâche « chaque service » : sur
        // toute autre, un service passé par erreur scinderait le cochage en
        // deux enregistrements pour une seule case à cocher.
        const service = task.frequency === 'perService' ? options?.service : undefined;
        const id = taskCompletionId(taskId, dayKey, service);
        const now = Date.now();
        const entry: TaskCompletion = {
          id,
          taskId,
          taskLabel: task.label,
          dayKey,
          ...(service ? { service } : {}),
          timestamp: now,
          ...(data.employeeId ? { employeeId: data.employeeId } : {}),
          operatorName: data.operatorName.trim(),
          ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
          modifiedAt: now,
        };
        const rest = state.taskCompletions.filter((c) => c.id !== id);
        return { taskCompletions: [...rest, entry] };
      }),

      uncompleteTask: (taskId, dayKey, service) => set((state) => {
        const id = taskCompletionId(taskId, startOfDayMs(dayKey ?? Date.now()), service);
        return { taskCompletions: state.taskCompletions.map((c) => (c.id === id ? tomb(c) : c)) };
      }),

      // Une photo entre au moment où on valide le cochage — jamais avant : tant
      // que la feuille est ouverte le fichier n'est qu'un brouillon local, que
      // l'employé peut encore jeter. Une fois ici, elle ne sort plus (pas de
      // deletedAt sur TaskPhoto) : c'est ce qui en fait un témoignage.
      //
      // `url` reste absente jusqu'à l'envoi ; la file (photoQueue.ts) la
      // remplit via setTaskPhotoUrl. Un chemin local ne sert à rien sur un
      // autre appareil, il n'est donc jamais porté par l'enregistrement.
      addTaskPhoto: ({ taskId, dayKey, service, employeeId, operatorName }) => {
        const day = startOfDayMs(dayKey ?? Date.now());
        const id = randomId();
        const now = Date.now();
        set((state) => ({
          taskPhotos: [
            ...(state.taskPhotos ?? []),
            {
              id,
              completionId: taskCompletionId(taskId, day, service),
              taskId,
              dayKey: day,
              capturedAt: now,
              ...(employeeId ? { employeeId } : {}),
              operatorName: operatorName.trim(),
              modifiedAt: now,
            },
          ],
        }));
        return id;
      },

      setTaskPhotoUrl: (id, url) => set((state) => ({
        taskPhotos: (state.taskPhotos ?? []).map((p) =>
          (p.id === id ? { ...p, url, modifiedAt: Date.now() } : p)
        ),
      })),

      setTaskReminderHour: (hour) => set({ taskReminderHour: hour }),

      // --- Inventaire ------------------------------------------------------
      //
      // Le catalogue d'articles est la liste d'ingrédients au niveau où on les
      // étiquette. Le stock n'est jamais stocké dessus : il se lit en sommant
      // le registre (voir inventory.ts, qui explique pourquoi).

      // Création idempotente : rappeler avec un nom déjà pris rend l'article
      // existant au lieu d'en créer un double. C'est ce qui permet à la création
      // en ligne depuis l'écran d'étiquette d'être un simple tap sans risque.
      addArticle: ({ name, unit, minQty, categoryId, ...location }) => {
        const existing = findArticleByName(get().articles, name);
        if (existing) return existing.id;
        const id = randomId();
        const now = Date.now();
        set((state) => ({
          articles: [
            ...state.articles,
            {
              id,
              name: name.trim(),
              unit,
              ...(categoryId ? { categoryId } : {}),
              ...pickLocation(location),
              ...(minQty !== undefined ? { minQty } : {}),
              modifiedAt: now,
            } as Article,
          ],
        }));
        return id;
      },

      // L'unité est librement modifiable, y compris vers une autre famille.
      //
      // Dans la même famille (kg ↔ g) c'est sans effet de bord : la somme
      // reconvertit chaque mouvement depuis l'unité qu'il a snapshottée. D'une
      // famille à l'autre (kg → pce), rien ne convertit des kilos en pièces :
      // stockByArticle IGNORE alors les mouvements devenus inconvertibles, donc
      // le stock ne compte plus que les nouveaux. Le refus a été retiré — c'est
      // l'écran qui prévient (voir ArticlesManager), à l'utilisateur de décider.
      updateArticle: (id, patch) => {
        const state = get();
        const article = state.articles.find((a) => a.id === id);
        if (!article) return { ok: false, error: 'Article introuvable.' };

        if (patch.name !== undefined) {
          const clash = findArticleByName(state.articles, patch.name);
          if (clash && clash.id !== id) {
            return { ok: false, error: `Un article "${clash.name}" existe déjà.` };
          }
        }

        const now = Date.now();
        // Le rangement est remplacé en bloc : passer d'une étagère à une zone
        // doit effacer l'étagère, pas la laisser traîner sous la nouvelle zone.
        const touchesLocation =
          'zoneId' in patch || 'unitId' in patch || 'shelfId' in patch || 'bacId' in patch;
        set((st) => ({
          articles: st.articles.map((a) => {
            if (a.id !== id) return a;
            const { zoneId, unitId, shelfId, bacId, ...withoutLocation } = a;
            const { zoneId: _z, unitId: _u, shelfId: _s, bacId: _b, ...fields } = patch;
            const location = touchesLocation
              ? pickLocation(patch)
              : pickLocation({ zoneId, unitId, shelfId, bacId });
            return {
              ...withoutLocation,
              ...fields,
              ...location,
              ...(patch.name ? { name: patch.name.trim() } : {}),
              modifiedAt: now,
            } as Article;
          }),
        }));
        return { ok: true };
      },

      // Tombstone seulement. Les mouvements de l'article restent en base — on ne
      // perd jamais l'historique de ce qui est entré et sorti — ils cessent
      // simplement d'être comptés, l'article n'étant plus dans la liste vivante.
      deleteArticle: (id) => set((state) => ({
        articles: state.articles.map((a) => (a.id === id ? tomb(a) : a)),
      })),

      addArticleCategory: ({ name, color }) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
        const clash = findCategoryByName(get().articleCategories ?? [], trimmed);
        if (clash) return { ok: false, error: `Une catégorie "${clash.name}" existe déjà.` };
        const id = randomId();
        const now = Date.now();
        set((state) => ({
          articleCategories: [
            ...(state.articleCategories ?? []),
            { id, name: trimmed, ...(color ? { color } : {}), modifiedAt: now },
          ],
        }));
        return { ok: true, id };
      },

      updateArticleCategory: (id, patch) => {
        const list = get().articleCategories ?? [];
        if (!list.some((c) => c.id === id && !c.deletedAt)) {
          return { ok: false, error: 'Catégorie introuvable.' };
        }
        if (patch.name !== undefined) {
          const trimmed = patch.name.trim();
          if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
          const clash = findCategoryByName(list, trimmed);
          if (clash && clash.id !== id) {
            return { ok: false, error: `Une catégorie "${clash.name}" existe déjà.` };
          }
        }
        const now = Date.now();
        set((state) => ({
          articleCategories: (state.articleCategories ?? []).map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  ...(patch.color !== undefined ? { color: patch.color } : {}),
                  modifiedAt: now,
                }
              : c
          ),
        }));
        return { ok: true };
      },

      // Tombstone. Les articles qui la portaient ne sont PAS modifiés : ils
      // retombent d'eux-mêmes dans « Sans catégorie » à l'affichage (voir
      // articleCategoryGroups), donc restaurer la catégorie les y ramène tous
      // sans qu'on ait eu à réécrire chaque article.
      deleteArticleCategory: (id) => set((state) => ({
        articleCategories: (state.articleCategories ?? []).map((c) => (c.id === id ? tomb(c) : c)),
      })),

      // Remet les catégories d'origine qui ont été supprimées. Ressuscite le
      // tombstone existant au lieu d'en créer un double — les ids sont fixes.
      restoreDefaultArticleCategories: () => {
        const list = get().articleCategories ?? [];
        const missing = DEFAULT_ARTICLE_CATEGORIES.filter((d) => {
          const existing = list.find((c) => c.id === d.id);
          return !existing || existing.deletedAt;
        });
        if (!missing.length) return 0;
        const now = Date.now();
        set((state) => {
          const current = state.articleCategories ?? [];
          const restored = current.map((c) => {
            const d = missing.find((m) => m.id === c.id);
            return d ? { ...c, name: d.name, color: d.color, deletedAt: undefined, modifiedAt: now } : c;
          });
          const added = missing
            .filter((d) => !current.some((c) => c.id === d.id))
            .map((d) => ({ ...d, modifiedAt: now }) as ArticleCategory);
          return { articleCategories: [...restored, ...added] };
        });
        return missing.length;
      },

      // ─── Liste de courses ──────────────────────────────────────────────
      //
      // Catalogue (fournisseurs + produits) et quantités sont deux choses
      // séparées : vider la liste ne touche jamais au catalogue, supprimer un
      // produit du catalogue ne laisse jamais sa quantité derrière lui.

      addSupplier: ({ name, note }) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
        const clash = findSupplier(get().suppliers ?? [], trimmed);
        if (clash) return { ok: false, error: `Un fournisseur "${clash.name}" existe déjà.` };
        const id = randomId();
        const now = Date.now();
        set((state) => {
          const list = state.suppliers ?? [];
          const order = list.reduce((max, s) => Math.max(max, s.order ?? 0), -1) + 1;
          return {
            suppliers: [...list, { id, name: trimmed, ...(note?.trim() ? { note: note.trim() } : {}), order, modifiedAt: now }],
          };
        });
        return { ok: true, id };
      },

      updateSupplier: (id, patch) => {
        const list = get().suppliers ?? [];
        if (!list.some((s) => s.id === id && !s.deletedAt)) return { ok: false, error: 'Fournisseur introuvable.' };
        if (patch.name !== undefined) {
          const trimmed = patch.name.trim();
          if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
          const clash = findSupplier(list, trimmed);
          if (clash && clash.id !== id) return { ok: false, error: `Un fournisseur "${clash.name}" existe déjà.` };
        }
        const now = Date.now();
        set((state) => ({
          suppliers: (state.suppliers ?? []).map((s) =>
            s.id === id
              ? {
                  ...s,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
                  // Note vidée = note retirée, pas une chaîne vide qui traînerait
                  // dans le PDF sous forme de ligne blanche.
                  ...(patch.note !== undefined ? { note: patch.note.trim() || undefined } : {}),
                  modifiedAt: now,
                }
              : s
          ),
        }));
        return { ok: true };
      },

      // Suppression EN CASCADE, contrairement aux catégories d'inventaire : un
      // produit de courses sans fournisseur n'a nulle part où retomber d'utile,
      // et laisser quatorze orphelins dans « Sans fournisseur » est pire que de
      // les supprimer avec leur magasin. L'écran prévient du nombre concerné.
      deleteSupplier: (id) => set((state) => {
        const doomed = new Set(
          (state.shoppingItems ?? []).filter((i) => i.supplierId === id && !i.deletedAt).map((i) => i.id)
        );
        return {
          suppliers: (state.suppliers ?? []).map((s) => (s.id === id ? tomb(s) : s)),
          shoppingItems: (state.shoppingItems ?? []).map((i) => (doomed.has(i.id) ? tomb(i) : i)),
          shoppingEntries: zeroEntries(state.shoppingEntries ?? [], (e) => doomed.has(e.id) || e.supplierId === id),
        };
      }),

      addShoppingItem: ({ name, supplierId }) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
        // Le même nom chez deux fournisseurs différents est normal (Fraise est
        // à la fois un sirop, un coulis et un fruit) : le doublon ne se juge
        // que DANS un fournisseur.
        const clash = findShoppingItem(get().shoppingItems ?? [], trimmed, supplierId);
        if (clash) return { ok: false, error: `"${clash.name}" est déjà dans cette liste.` };
        const id = randomId();
        const now = Date.now();
        set((state) => {
          const list = state.shoppingItems ?? [];
          const order = list
            .filter((i) => (i.supplierId ?? null) === (supplierId ?? null))
            .reduce((max, i) => Math.max(max, i.order ?? 0), -1) + 1;
          return {
            shoppingItems: [...list, { id, name: trimmed, ...(supplierId ? { supplierId } : {}), order, modifiedAt: now }],
          };
        });
        return { ok: true, id };
      },

      updateShoppingItem: (id, patch) => {
        const list = get().shoppingItems ?? [];
        const current = list.find((i) => i.id === id && !i.deletedAt);
        if (!current) return { ok: false, error: 'Produit introuvable.' };
        const nextSupplier = patch.supplierId === undefined
          ? current.supplierId
          : (patch.supplierId ?? undefined);
        const nextName = patch.name !== undefined ? patch.name.trim() : current.name;
        if (!nextName) return { ok: false, error: 'Le nom est vide.' };
        const clash = findShoppingItem(list, nextName, nextSupplier);
        if (clash && clash.id !== id) return { ok: false, error: `"${clash.name}" est déjà dans cette liste.` };
        const now = Date.now();
        set((state) => ({
          shoppingItems: (state.shoppingItems ?? []).map((i) =>
            i.id === id ? { ...i, name: nextName, supplierId: nextSupplier, modifiedAt: now } : i
          ),
        }));
        return { ok: true };
      },

      // Le produit part, sa quantité aussi : sans ça, restaurer le produit plus
      // tard le ferait revenir avec une commande qu'on croyait effacée.
      deleteShoppingItem: (id) => set((state) => ({
        shoppingItems: (state.shoppingItems ?? []).map((i) => (i.id === id ? tomb(i) : i)),
        shoppingEntries: zeroEntries(state.shoppingEntries ?? [], (e) => e.id === id),
      })),

      // Upsert sur un id DÉTERMINISTE (= l'id du produit) : deux personnes qui
      // saisissent le même produit hors ligne convergent sur UNE ligne à la
      // fusion, au lieu d'additionner deux enregistrements concurrents.
      //
      // Une quantité à 0 garde son enregistrement — c'est ce qui la fait
      // gagner sur l'ancienne valeur d'un autre appareil (dernier-écrit-gagne).
      // Supprimer la ligne, à l'inverse, la laisserait ressusciter au prochain
      // merge : le cloud a encore la sienne, et la fusion est une union.
      setShoppingQty: (itemId, qty) => set((state) => {
        const clean = Number.isFinite(qty) ? Math.max(0, qty) : 0;
        const entries = state.shoppingEntries ?? [];
        const now = Date.now();
        if (entries.some((e) => e.id === itemId)) {
          return {
            shoppingEntries: entries.map((e) =>
              e.id === itemId ? { ...e, qty: clean, deletedAt: undefined, modifiedAt: now } : e
            ),
          };
        }
        return { shoppingEntries: [...entries, { id: itemId, qty: clean, modifiedAt: now }] };
      }),

      // Ligne libre : un produit hors catalogue, pour cette tournée seulement.
      // Si le nom correspond en fait à un produit du catalogue du même
      // fournisseur, on renseigne CE produit plutôt que de créer un doublon —
      // sinon la même chose apparaîtrait deux fois sur le PDF.
      addShoppingExtra: ({ name, supplierId, qty }) => {
        const trimmed = name.trim();
        if (!trimmed) return { ok: false, error: 'Le nom est vide.' };
        const amount = Number.isFinite(qty) && (qty as number) > 0 ? (qty as number) : 1;
        const known = findShoppingItem(get().shoppingItems ?? [], trimmed, supplierId);
        if (known) {
          get().setShoppingQty(known.id, amount);
          return { ok: true, id: known.id };
        }
        const id = randomId();
        const now = Date.now();
        set((state) => ({
          shoppingEntries: [
            ...(state.shoppingEntries ?? []),
            { id, name: trimmed, ...(supplierId ? { supplierId } : {}), qty: amount, modifiedAt: now },
          ],
        }));
        return { ok: true, id };
      },

      removeShoppingExtra: (id) => set((state) => ({
        shoppingEntries: (state.shoppingEntries ?? []).map((e) => (e.id === id ? tomb(e) : e)),
      })),

      // Fin de tournée : tout revient à zéro, le catalogue est intact.
      // Les produits du catalogue retombent à 0 (l'enregistrement reste, voir
      // setShoppingQty), les lignes libres disparaissent pour de bon.
      clearShoppingList: () => {
        const live = (get().shoppingEntries ?? []).filter((e) => !e.deletedAt && e.qty > 0);
        if (!live.length) return 0;
        const now = Date.now();
        set((state) => ({
          shoppingEntries: (state.shoppingEntries ?? []).map((e) => {
            if (e.deletedAt) return e;
            if (e.name) return { ...e, qty: 0, modifiedAt: now, deletedAt: now };
            return e.qty === 0 ? e : { ...e, qty: 0, modifiedAt: now };
          }),
        }));
        return live.length;
      },

      // Remet le catalogue d'origine supprimé — fournisseurs ET produits.
      // Ressuscite les tombstones existants au lieu d'en créer des doubles :
      // les ids de la graine sont fixes.
      restoreDefaultShoppingCatalog: () => {
        const suppliers = get().suppliers ?? [];
        const items = get().shoppingItems ?? [];
        const missingSuppliers = DEFAULT_SUPPLIERS.filter((d) => {
          const existing = suppliers.find((s) => s.id === d.id);
          return !existing || existing.deletedAt;
        });
        const missingItems = DEFAULT_SHOPPING_ITEMS.filter((d) => {
          const existing = items.find((i) => i.id === d.id);
          return !existing || existing.deletedAt;
        });
        if (!missingSuppliers.length && !missingItems.length) return 0;
        const now = Date.now();
        set((state) => {
          const currentSuppliers = state.suppliers ?? [];
          const currentItems = state.shoppingItems ?? [];
          const restoredSuppliers = currentSuppliers.map((s) => {
            const d = missingSuppliers.find((m) => m.id === s.id);
            return d ? { ...s, name: d.name, note: d.note, deletedAt: undefined, modifiedAt: now } : s;
          });
          const addedSuppliers = missingSuppliers
            .filter((d) => !currentSuppliers.some((s) => s.id === d.id))
            .map((d) => ({
              ...d,
              order: DEFAULT_SUPPLIERS.findIndex((x) => x.id === d.id),
              modifiedAt: now,
            }) as Supplier);
          const restoredItems = currentItems.map((i) => {
            const d = missingItems.find((m) => m.id === i.id);
            return d ? { ...i, name: d.name, supplierId: d.supplierId, deletedAt: undefined, modifiedAt: now } : i;
          });
          const addedItems = missingItems
            .filter((d) => !currentItems.some((i) => i.id === d.id))
            .map((d) => ({ ...d, modifiedAt: now }) as ShoppingItem);
          return {
            suppliers: [...restoredSuppliers, ...addedSuppliers],
            shoppingItems: [...restoredItems, ...addedItems],
          };
        });
        return missingSuppliers.length + missingItems.length;
      },

      // Amorçage du catalogue depuis les étiquettes déjà saisies : un article
      // par nom distinct, dans l'unité la plus utilisée pour ce nom.
      //
      // Ne rattache que les étiquettes ACTIVES, volontairement. Rattacher les
      // étiquettes déjà utilisées ou jetées fabriquerait des sorties datées
      // d'avant l'existence de l'inventaire, sans les entrées correspondantes :
      // le stock partirait profondément négatif. Un inventaire démarre sur ce
      // qui est là aujourd'hui — le reste appartient à l'historique.
      importArticlesFromProducts: () => {
        const state = get();
        const active = state.products.filter((p) => !p.deletedAt && p.status === 'active' && p.name.trim());

        // Unité dominante par nom : si 8 étiquettes "Poulet" sont en kg et 1 en
        // g, l'article naît en kg.
        const byName = new Map<string, { name: string; units: Map<string, number> }>();
        for (const p of active) {
          const key = normalizeArticleName(p.name);
          if (!key) continue;
          const entry = byName.get(key) ?? { name: p.name.trim(), units: new Map<string, number>() };
          entry.units.set(p.unit, (entry.units.get(p.unit) ?? 0) + 1);
          byName.set(key, entry);
        }

        const now = Date.now();
        const articles = [...state.articles];
        let created = 0;
        for (const [, entry] of byName) {
          if (findArticleByName(articles, entry.name)) continue;
          const unit = [...entry.units.entries()].sort((a, b) => b[1] - a[1])[0][0];
          articles.push({ id: randomId(), name: entry.name, unit, modifiedAt: now });
          created += 1;
        }

        let linked = 0;
        let movements = state.stockMovements;
        const products: Product[] = state.products.map((p) => {
          if (p.deletedAt || p.status !== 'active' || p.articleId) return p;
          const article = findArticleByName(articles, p.name);
          if (!article) return p;
          linked += 1;
          const syncStatus: Product['syncStatus'] = state.isOffline ? 'offline' : 'pending';
          return { ...p, articleId: article.id, modifiedAt: now, syncStatus };
        });
        // Le registre est aligné après coup, une étiquette à la fois : chaque
        // étiquette fraîchement rattachée entre en stock avec sa quantité.
        for (const p of products) {
          if (p.articleId && !p.deletedAt && p.status === 'active') {
            movements = reconcileProductMovements(p, articles, movements);
          }
        }

        set({ articles, products, stockMovements: movements });
        return { created, linked };
      },

      // Range d'un tap les articles qui n'ont pas encore d'emplacement, d'après
      // l'endroit où leurs étiquettes actives sont posées — aussi profond que
      // ces étiquettes sont d'accord (voir deducedLocationOf). Rattrapage pour
      // les catalogues amorcés avant que l'emplacement n'existe.
      //
      // N'écrase JAMAIS un emplacement déjà choisi, et laisse tel quel l'article
      // qu'aucune étiquette ne localise — mieux vaut le laisser à ranger que le
      // poser au hasard.
      //
      // `includeZoneOnly` élargit la cible aux articles rangés à la zone SEULE,
      // pour rattraper ceux placés par la première version qui ne descendait
      // jamais plus bas. Réservé au rattrapage unique du démarrage : sur le
      // bouton, ça reviendrait à défaire un choix délibéré de l'utilisateur.
      autoAssignArticleLocations: (options) => {
        const state = get();
        const structure = {
          bacs: state.bacs.filter((b) => !b.deletedAt),
          shelves: state.shelves.filter((s) => !s.deletedAt),
          storageUnits: state.storageUnits.filter((u) => !u.deletedAt),
        };
        const now = Date.now();
        let placed = 0;
        let remaining = 0;
        const targeted = (a: Article) =>
          options?.includeZoneOnly
            ? a.unitId === undefined && a.shelfId === undefined && a.bacId === undefined
            : a.zoneId === undefined;
        const articles = state.articles.map((a) => {
          if (a.deletedAt || !targeted(a)) return a;
          const location = deducedLocationOf(a.id, state.products, structure);
          // Rien de plus précis que ce qu'il a déjà : on le laisse tranquille
          // plutôt que de le réécrire pour rien.
          if (!location || (a.zoneId === location.zoneId && !location.unitId)) {
            remaining += 1;
            return a;
          }
          placed += 1;
          return { ...a, ...pickLocation(location), modifiedAt: now };
        });
        if (placed) set({ articles });
        return { placed, remaining };
      },

      // Saisie manuelle : livraison entrée à la main, sortie qui ne passe pas par
      // une étiquette (casse, transfert…). Id aléatoire — contrairement aux
      // mouvements d'étiquette, deux saisies manuelles identiques sont deux
      // événements réels distincts et doivent toutes les deux compter.
      addStockMovement: ({ articleId, kind, qty, timestamp, operatorName, notes }) => set((state) => {
        const article = state.articles.find((a) => a.id === articleId && !a.deletedAt);
        if (!article || !qty) return {};
        const now = Date.now();
        return {
          stockMovements: [
            ...state.stockMovements,
            {
              id: randomId(),
              articleId,
              articleName: article.name,
              unit: article.unit,
              kind,
              qty: kind === 'adjust' ? qty : Math.abs(qty),
              timestamp: timestamp ?? now,
              ...(operatorName ? { operatorName } : {}),
              ...(notes ? { notes } : {}),
              modifiedAt: now,
            } as StockMovement,
          ],
        };
      }),

      // Modification manuelle de la quantité : l'utilisateur pose le chiffre juste,
      // et c'est l'ÉCART qui part au registre — jamais une réécriture du stock.
      // C'est ce qui garde le reste intact : les entrées et sorties d'étiquettes
      // continuent de compter par-dessus, et l'historique dit qui a modifié quoi.
      //
      // Un écart nul est enregistré aussi : il prouve que quelqu'un a vérifié.
      setStockCount: (articleId, countedQty, data) => set((state) => {
        const article = state.articles.find((a) => a.id === articleId && !a.deletedAt);
        if (!article) return {};
        const onHand = stockByArticle(state.articles, state.stockMovements).get(articleId) ?? 0;
        const now = Date.now();
        return {
          stockMovements: [
            ...state.stockMovements,
            {
              id: randomId(),
              articleId,
              articleName: article.name,
              unit: article.unit,
              kind: 'adjust',
              qty: roundQty(countedQty - onHand),
              timestamp: now,
              ...(data?.operatorName ? { operatorName: data.operatorName } : {}),
              ...(data?.notes ? { notes: data.notes } : {}),
              modifiedAt: now,
            } as StockMovement,
          ],
        };
      }),

      // Seules les saisies manuelles se suppriment. Un mouvement né d'une
      // étiquette serait recréé au prochain reconcile : c'est l'étiquette qu'il
      // faut corriger, et le message le dit plutôt que d'échouer en silence.
      deleteStockMovement: (id) => {
        const movement = get().stockMovements.find((m) => m.id === id);
        if (!movement) return { ok: false, error: 'Mouvement introuvable.' };
        if (movement.productId) {
          return { ok: false, error: "Ce mouvement vient d'une étiquette — modifie ou supprime l'étiquette." };
        }
        set((state) => ({
          stockMovements: state.stockMovements.map((m) => (m.id === id ? tomb(m) : m)),
        }));
        return { ok: true };
      },

      setUser: (user) => set({ user }),

      updateSettings: (newSettings) => set((state) => ({
        user: state.user ? { ...state.user, settings: { ...state.user.settings, ...newSettings } } : null,
      })),

      setOffline: (isOffline) => set({ isOffline }),

      // One pending photo per product: a re-capture replaces any existing entry.
      enqueuePendingPhoto: (productId, localPath) => set((state) => ({
        pendingPhotos: [
          ...state.pendingPhotos.filter((p) => p.productId !== productId),
          { productId, localPath, queuedAt: Date.now() },
        ],
      })),
      removePendingPhoto: (productId) => set((state) => ({
        pendingPhotos: state.pendingPhotos.filter((p) => p.productId !== productId),
      })),

      // Contrairement aux produits, un cochage peut porter plusieurs photos :
      // les entrées s'accumulent au lieu de se remplacer, une par TaskPhoto.
      enqueueTaskPhotoUpload: (taskPhotoId, localPath) => set((state) => ({
        pendingPhotos: [
          ...state.pendingPhotos.filter((p) => p.taskPhotoId !== taskPhotoId),
          { kind: 'task', taskPhotoId, localPath, queuedAt: Date.now() },
        ],
      })),
      removeTaskPhotoUpload: (taskPhotoId) => set((state) => ({
        pendingPhotos: state.pendingPhotos.filter((p) => p.taskPhotoId !== taskPhotoId),
      })),

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
            // Checklist d'équipe. `?? []` : les docs cloud d'avant la
            // fonctionnalité n'ont pas ces clés — rien à migrer, elles arrivent vides.
            employees: mergeNewer(state.employees ?? [], cloud.employees),
            tasks: mergeNewer(state.tasks ?? [], cloud.tasks),
            taskCompletions: mergeNewer(state.taskCompletions ?? [], cloud.taskCompletions),
            // Une photo ne se supprime pas, mais son enregistrement change une
            // fois (l'envoi y écrit `url`) : newer-wins, pas append-only.
            taskPhotos: mergeNewer(state.taskPhotos ?? [], cloud.taskPhotos),
            // Réglage — local wins once set ; un appareil neuf prend la valeur du cloud.
            taskReminderHour: state.taskReminderHour ?? cloud.taskReminderHour,
            cleaningAreas: Array.from(new Set([...(state.cleaningAreas ?? []), ...((cloud.cleaningAreas as string[]) ?? [])])),
            pestControlChecks: mergeNewer(state.pestControlChecks ?? [], cloud.pestControlChecks),
            pestStations: mergeNewer(state.pestStations ?? [], cloud.pestStations),
            // Cadence config — local wins once set; a fresh device picks up the cloud value.
            pestCadence: state.pestCadence ?? (cloud.pestCadence as PestCadence | undefined),
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
            // Inventaire. `?? []` : les docs cloud d'avant la fonctionnalité
            // n'ont pas ces clés — rien à migrer, elles arrivent vides. Le
            // registre fusionne en newer-wins comme le reste : les mouvements
            // nés d'une étiquette ont un id déterministe, donc deux appareils
            // qui ont sorti la même étiquette convergent sur une seule ligne.
            articles: mergeNewer(state.articles ?? [], cloud.articles),
            stockMovements: mergeNewer(state.stockMovements ?? [], cloud.stockMovements),
            // Les catégories d'origine ont un id fixe et `modifiedAt: 0`, donc la
            // graine locale perd contre toute vraie modification venue du cloud
            // — y compris une suppression. Une catégorie supprimée sur un appareil
            // ne peut pas ressusciter depuis la graine d'un autre.
            articleCategories: mergeNewer(state.articleCategories ?? [], cloud.articleCategories),
            // Liste de courses. Le catalogue d'origine a des ids fixes et
            // `modifiedAt: 0`, donc la graine locale perd contre toute vraie
            // modification venue du cloud — un fournisseur supprimé sur un
            // appareil ne ressuscite pas depuis la graine d'un autre.
            suppliers: mergeNewer(state.suppliers ?? [], cloud.suppliers),
            shoppingItems: mergeNewer(state.shoppingItems ?? [], cloud.shoppingItems),
            // Une quantité par produit, id déterministe : deux téléphones qui
            // remplissent la liste en même temps gardent chacun leurs lignes,
            // et le dernier à toucher UN produit décide de SA quantité.
            shoppingEntries: mergeNewer(state.shoppingEntries ?? [], cloud.shoppingEntries),
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
        pestControlChecks: state.pestControlChecks,
        pestStations: state.pestStations,
        pestCadence: state.pestCadence,
        closedWeekdays: state.closedWeekdays,
        singleServiceWeekdays: state.singleServiceWeekdays,
        dayOverrides: state.dayOverrides,
        receptions: state.receptions,
        dailyRemarks: state.dailyRemarks,
        witnessSamples: state.witnessSamples,
        employees: state.employees,
        tasks: state.tasks,
        taskCompletions: state.taskCompletions,
        taskPhotos: state.taskPhotos,
        taskReminderHour: state.taskReminderHour,
        productUnits: state.productUnits,
        articles: state.articles,
        stockMovements: state.stockMovements,
        articleCategories: state.articleCategories,
        suppliers: state.suppliers,
        shoppingItems: state.shoppingItems,
        shoppingEntries: state.shoppingEntries,
        customActionTypes: state.customActionTypes,
        defaultActionTypeStates: state.defaultActionTypeStates,
        user: state.user,
        isOffline: state.isOffline,
        lastSyncAt: state.lastSyncAt,
        lastSyncStatus: state.lastSyncStatus,
        lastSyncError: state.lastSyncError,
        pendingPhotos: state.pendingPhotos,
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
