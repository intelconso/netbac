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

// Contrôle des huiles de friture — one global daily check (paper HACCP
// register page "Contrôles des huiles de friture"). When the oil is changed,
// the used oil must legally be collected by an approved organization; the
// pickup itself is just noted in `notes`.
export interface OilCheck {
  id: string;
  timestamp: number;
  result: 'conforme' | 'non_conforme';
  oilChanged: boolean;
  // Legacy — the app has a single role, operator is no longer recorded.
  // Kept optional so records written by older versions still parse.
  operatorId?: string;
  operatorName?: string;
  notes?: string;
  // Entered after the fact for a missed day: `timestamp` sits on the day the
  // control covers, `recordedAt` is the real entry time. Flagged for audit
  // transparency in history and PDF reports.
  backfilled?: boolean;
  // Exact moment the entry was created. Never changes afterwards — unlike
  // modifiedAt, which is bumped by edits for sync purposes.
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Relevé des températures des enceintes frigorifiques (registre papier,
// arrêté du 21 décembre 2009 annexe 1) — deux relevés par jour et par
// enceinte : début et fin de service. `conform` is derived from the unit's
// regulatory target at save time and stored as the audit snapshot;
// `correctiveAction` is required when non-conform.
export interface FridgeTempCheck {
  id: string;
  unitId: string;
  service: 'debut' | 'fin';
  timestamp: number;
  temperature: number;
  conform: boolean;
  correctiveAction?: string;
  // Legacy — see OilCheck: single-role app, no longer recorded.
  operatorId?: string;
  operatorName?: string;
  // Entered after the fact for a missed day — see OilCheck.backfilled.
  backfilled?: boolean;
  // Exact creation moment, immutable — see OilCheck.recordedAt.
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Fabrication(s) du jour (registre papier) — une ligne par préparation.
// Les types de fabrication sont paramétrables par l'admin : chaque type
// définit la liste des champs du formulaire (schema-driven form).
export type LotUsage = 'entier' | 'fractionne' | 'retravaille';
export type FabricationDestination = 'congelateur' | 'froid_positif' | 'liaison_chaude' | 'servi' | 'emporte' | 'livre';

export type FabricationFieldKind = 'text' | 'number' | 'choice' | 'multi_choice' | 'toggle';

export interface FabricationField {
  id: string;                  // stable generated key, never reused
  label: string;               // ex. "T°C début"
  kind: FabricationFieldKind;
  required?: boolean;
  options?: string[];          // for choice / multi_choice
  unit?: string;               // display suffix, ex. "°C"
}

export interface FabricationType {
  id: string;
  label: string;
  fields: FabricationField[];  // ordered — this IS the form definition
  modifiedAt: number;
  deletedAt?: number;
}

// Value snapshot: the record carries its own labels so it keeps rendering
// in history/PDF even if the admin later edits or deletes the type.
export interface FabricationValue {
  fieldId: string;
  label: string;
  value: string | number | boolean | string[];
}

export interface Fabrication {
  id: string;
  timestamp: number;
  name: string;
  // Schema-driven records
  typeId?: string;
  typeLabel?: string;          // snapshot of the type label at save time
  values?: FabricationValue[];
  // Legacy fixed-field records (first version of the feature)
  ingredients?: string;
  lotUsage?: LotUsage;
  cookingTime?: string;
  cookingTemp?: number;
  coolingTempStart?: number;
  coolingTempEnd?: number;
  destinations?: FabricationDestination[];
  backfilled?: boolean;
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Contrôles nettoyage (registre papier) — un contrôle quotidien par zone de
// nettoyage (Restaurant/Salle, Cuisine/Stockage, ...). Les zones sont une
// liste paramétrable (AppState.cleaningAreas) ; le record snapshotte le
// libellé de la zone, donc renommer/supprimer une zone ne casse rien.
export interface CleaningCheck {
  id: string;
  area: string;                 // label snapshot of the cleaning zone
  timestamp: number;
  result: 'conforme' | 'non_conforme';
  correctiveAction?: string;    // required when non_conforme
  backfilled?: boolean;
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
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
  oilChecks: OilCheck[];
  fridgeTempChecks: FridgeTempCheck[];
  fabrications: Fabrication[];
  fabricationTypes: FabricationType[];
  cleaningChecks: CleaningCheck[];
  cleaningAreas: string[];
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
