export type ZoneType = 'cuisine' | 'chambre_froide' | 'bar' | 'reserve' | 'plonge' | 'patisserie' | 'autre';

export interface Zone {
  id: string;
  name: string;
  type: ZoneType;
  modifiedAt: number;
  deletedAt?: number;
}

export interface StorageUnit {
  id: string;
  zoneId: string;
  name: string; // e.g., "Frigo 1", "Chambre Froide"
  type: 'frigo' | 'congelateur' | 'reserve' | 'saladette' | 'autre';
  modifiedAt: number;
  deletedAt?: number;
}

export interface Shelf {
  id: string;
  unitId: string;
  level: number; // 1 for top, etc.
  name: string; // e.g., "Étagère 1"
  modifiedAt: number;
  deletedAt?: number;
}

export type ContainerType = 'bac' | 'boite' | 'tiroir' | 'etagere' | 'autre';
export type ActionType = 'cooked' | 'opened' | 'defrosted' | 'received' | 'cooling';

export interface Bac {
  id: string;
  shelfId: string; // Linked to a shelf
  name: string;
  type: ContainerType;
  createdAt: number;
  modifiedAt: number;
  deletedAt?: number;
  syncStatus: 'synced' | 'pending' | 'offline';
}

export interface Product {
  id: string;
  bacId: string;
  name: string;
  quantity: number;
  unit: string; // kg, g, l, ml, piece, broche, etc.
  dlc: number; // Timestamp
  addedAt: number;
  modifiedAt: number;
  deletedAt?: number;
  actionType: ActionType;
  status: 'active' | 'used' | 'discarded';
  syncStatus: 'synced' | 'pending' | 'offline';
  // Professional details (Optional)
  temperature?: number;
  origin?: string;
  notes?: string;
  // Real-world date of use, when different from modifiedAt — set when the
  // user back-dates a "Utilisé" action (typically because the label expired
  // before they remembered to mark it).
  usedAt?: number;
  // Refroidissement rapide HACCP — fields captured when actionType === 'cooling'.
  coolingStartedAt?: number;
  coolingFinishedAt?: number;
  coolingTempStart?: number;
  coolingTempEnd?: number;
}

export interface TemperatureLog {
  id: string;
  unitId: string;
  timestamp: number;
  temperature: number;
  operatorId: string;
  operatorName: string;
  status: 'ok' | 'alert';
}

export interface CleaningTask {
  id: string;
  unitId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  lastDone?: number;
  nextDue: number;
  modifiedAt: number;
  deletedAt?: number;
}

export interface CustomActionType {
  id: string;
  label: string;
  dlcDays: number;
  modifiedAt: number;
  deletedAt?: number;
}

export interface DefaultActionTypeState {
  id: ActionType;
  disabled: boolean;
  modifiedAt: number;
}

export interface User {
  id: string;
  name: string;
  restaurantName: string;
  isPro: boolean;
  signature?: string;
  settings: {
    enableTemperature: boolean;
    enableCleaning: boolean;
    simplifiedMode: boolean;
  };
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

export interface AppState {
  zones: Zone[];
  storageUnits: StorageUnit[];
  shelves: Shelf[];
  bacs: Bac[];
  products: Product[];
  tempLogs: TemperatureLog[];
  cleaningTasks: CleaningTask[];
  productUnits: string[];
  customActionTypes: CustomActionType[];
  defaultActionTypeStates: DefaultActionTypeState[];
  user: User | null;
  isOffline: boolean;
  // Cloud sync state
  lastSyncAt: number | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
}
