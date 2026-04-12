export interface Zone {
  id: string;
  name: string;
  icon: string;
}

export interface StorageUnit {
  id: string;
  zoneId: string;
  name: string; // e.g., "Frigo 1", "Chambre Froide"
  type: 'frigo' | 'congelateur' | 'reserve' | 'saladette' | 'autre';
  icon: string;
}

export interface Shelf {
  id: string;
  unitId: string;
  level: number; // 1 for top, etc.
  name: string; // e.g., "Étagère 1"
}

export type ContainerType = 'bac' | 'boite' | 'tiroir' | 'etagere' | 'autre';
export type ActionType = 'cooked' | 'opened' | 'defrosted' | 'received';

export interface Bac {
  id: string;
  shelfId: string; // Linked to a shelf
  name: string;
  type: ContainerType;
  color: string;
  icon: string;
  createdAt: number;
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
  actionType: ActionType;
  status: 'active' | 'used' | 'discarded';
  syncStatus: 'synced' | 'pending' | 'offline';
  // Professional details (Optional)
  batchNumber?: string;
  preparerName?: string;
  temperature?: number;
  origin?: string;
  notes?: string;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'add_product' | 'use_product' | 'discard_product' | 'update_product' | 'temp_check' | 'cleaning';
  details: string;
  entityId?: string; // ID of product, unit, etc.
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

export interface AppState {
  zones: Zone[];
  storageUnits: StorageUnit[];
  shelves: Shelf[];
  bacs: Bac[];
  products: Product[];
  logs: ActivityLog[];
  tempLogs: TemperatureLog[];
  cleaningTasks: CleaningTask[];
  user: User | null;
  isOffline: boolean;
}
