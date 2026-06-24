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

// Enceinte du relevé de température. Initialisée depuis les enceintes froides de
// la structure, puis gérée indépendamment (renommage / suppression / ajout) dans
// Paramètres → Personnalisation. `type` réutilise les types froids de StorageUnit
// pour dériver la plage réglementaire (voir fridgeTemp.ts).
export interface TempUnit {
  id: string;
  name: string;
  type: StorageUnit['type'];
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
  operatorId?: string;
  // Contrôleur — mirrors the register's "Signature du contrôleur" column.
  // Optional so records from versions that didn't capture it still parse.
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
  operatorId?: string;
  // Contrôleur — see OilCheck.operatorName.
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
  // Contrôleur — see OilCheck.operatorName.
  operatorName?: string;
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
  // Contrôleur — see OilCheck.operatorName.
  operatorName?: string;
  backfilled?: boolean;
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Réceptions de la journée (registre papier) — un contrôle par livraison :
// fournisseur, n° de BL ou de facture, résultat du contrôle à réception,
// action corrective si besoin.
export interface ReceptionCheck {
  id: string;
  timestamp: number;
  supplier: string;
  reference?: string;          // n° de BL ou n° de facture
  result: 'conforme' | 'non_conforme';
  correctiveAction?: string;   // required when non_conforme
  // Contrôleur — see OilCheck.operatorName.
  operatorName?: string;
  backfilled?: boolean;
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Enregistrement des remarques de la journée (registre papier) — notes libres :
// dysfonctionnement, réclamation client, envoi d'analyses, visite de contrôle,
// début de nouvelles mises en place...
export interface DailyRemark {
  id: string;
  timestamp: number;
  text: string;
  // Contrôleur — see OilCheck.operatorName.
  operatorName?: string;
  backfilled?: boolean;
  recordedAt?: number;
  modifiedAt: number;
  deletedAt?: number;
}

// Prélèvement des plats témoins (restauration collective uniquement) —
// un oui/non par jour.
export interface WitnessSample {
  id: string;
  timestamp: number;
  taken: boolean;
  // Contrôleur — see OilCheck.operatorName.
  operatorName?: string;
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

// Plan de lutte contre les nuisibles — PMS, arrêté du 9/05/1995 art. 17.
// Contrairement aux contrôles quotidiens (huiles, températures, nettoyage),
// celui-ci est périodique : un passage tous les X jours/semaines/mois.

// Cadence du prochain contrôle — sert à pré-remplir "Prochain contrôle".
export type PestCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly';

// Station du plan de lutte (le "plan" papier : PIÈGE 1 = SAS, PIÈGE 2 = Cuisine…).
// Capturée comme une liste n° + zone — mêmes infos que le plan, sans carte dessinée.
export interface PestStation {
  id: string;
  number: string;   // n° du piège / appât, ex. "1"
  zone: string;     // emplacement, ex. "Cuisine", "Réserve"
  modifiedAt: number;
  deletedAt?: number;
}

// Registre de suivi — dératisation / désinsectisation. Une entrée par passage
// (interne ou prestataire), mappant les colonnes du registre papier.
export interface PestControlCheck {
  id: string;
  timestamp: number;                                              // Date du passage
  interventionTypes: ('deratisation' | 'desinsectisation')[];     // Type (Déra / Désin)
  nature: 'preventif' | 'curatif';                                // Préventif / Curatif
  zones?: string;                                                 // Zones concernées
  baitLocations?: string;                                         // Localisation appâts / pièges
  products?: string;                                              // Produits utilisés
  amm?: string;                                                   // N° AMM
  findings?: string;                                              // Constats (traces, captures, activité)
  correctiveAction?: string;                                      // Actions correctives
  nextCheck?: number;                                             // Prochain contrôle (auto depuis la cadence)
  // Responsable du passage — mirrors the register's signature column. See OilCheck.operatorName.
  operatorName?: string;
  backfilled?: boolean;
  recordedAt?: number;
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

// Statut de service d'une journée.
// open : service complet (température début + fin).
// single : service unique (un seul relevé de température par enceinte).
// closed : fermé (aucun contrôle attendu).
export type DayServiceStatus = 'open' | 'single' | 'closed';

// Exception ponctuelle sur une date précise — prime sur le défaut hebdomadaire.
// `date` est le début de journée (ms, heure locale) ; `id` en est dérivé pour
// qu'une même date fusionne proprement entre appareils.
export interface DayOverride {
  id: string;
  date: number;
  status: DayServiceStatus;
  modifiedAt: number;
  deletedAt?: number;
}

export interface AppState {
  zones: Zone[];
  storageUnits: StorageUnit[];
  // Enceintes du relevé de température. `undefined` = jamais personnalisé : la
  // liste reflète alors les enceintes froides de la structure (voir tempUnits.ts).
  // Au premier ajout/renommage/suppression, elle est figée puis indépendante.
  tempUnits?: TempUnit[];
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
  // Plan de lutte contre les nuisibles (PMS — périodique, pas quotidien).
  // `pestCadence` undefined = jamais réglé → défaut hebdomadaire dans l'UI.
  pestControlChecks: PestControlCheck[];
  pestStations: PestStation[];
  pestCadence?: PestCadence;
  // Planning de service. Chaque jour est ouvert / service unique / fermé.
  // - closedWeekdays : jours fermés récurrents (getDay() : 0 = dim … 6 = sam).
  //   Aucun contrôle attendu ni compté comme manquant.
  // - singleServiceWeekdays : jours à service unique récurrents. Les contrôles
  //   quotidiens restent attendus, mais la température n'exige qu'un relevé par
  //   enceinte (au lieu de début + fin).
  // - dayOverrides : exceptions ponctuelles sur une date précise (jour férié,
  //   ouverture exceptionnelle…) qui priment sur le défaut hebdomadaire.
  closedWeekdays: number[];
  singleServiceWeekdays: number[];
  dayOverrides: DayOverride[];
  receptions: ReceptionCheck[];
  dailyRemarks: DailyRemark[];
  witnessSamples: WitnessSample[];
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
