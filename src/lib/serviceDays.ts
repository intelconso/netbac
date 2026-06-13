// Planning de service du restaurant — chaque journée est ouverte / service
// unique / fermée. Détermine ce qu'attendent les contrôles quotidiens :
//
// - open   : service complet → température relevée en début ET en fin de service.
// - single : service unique  → un seul relevé de température par enceinte
//            (norme : un relevé par service). Huiles et nettoyage restent
//            attendus une fois, comme un jour ouvert.
// - closed : fermé → aucun contrôle attendu ni compté comme jour manquant.
//
// Résolution : une exception ponctuelle (dayOverrides) prime sur le défaut
// hebdomadaire (closedWeekdays / singleServiceWeekdays). Configuré dans
// Paramètres → Personnalisation → Jours & services.
//
// Les valeurs de jour suivent getDay() : 0 = dimanche … 6 = samedi.

import { DayServiceStatus } from '../types';

export const WEEKDAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: 'Lundi', short: 'Lun' },
  { value: 2, label: 'Mardi', short: 'Mar' },
  { value: 3, label: 'Mercredi', short: 'Mer' },
  { value: 4, label: 'Jeudi', short: 'Jeu' },
  { value: 5, label: 'Vendredi', short: 'Ven' },
  { value: 6, label: 'Samedi', short: 'Sam' },
  { value: 0, label: 'Dimanche', short: 'Dim' },
];

export const STATUS_LABELS: Record<DayServiceStatus, string> = {
  open: 'Ouvert',
  single: 'Service unique',
  closed: 'Fermé',
};

export function startOfDayMs(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Id déterministe d'une exception, pour qu'une même date fusionne entre appareils.
export function dayOverrideId(dayMs: number): string {
  return `ovr-${startOfDayMs(dayMs)}`;
}

export interface DaySchedule {
  closedWeekdays?: number[];
  singleServiceWeekdays?: number[];
  dayOverrides?: { date: number; status: DayServiceStatus; deletedAt?: number }[];
}

// Statut d'une journée (timestamp ms, n'importe quel instant de la journée).
export function dayStatus(dayMs: number, schedule: DaySchedule): DayServiceStatus {
  const d0 = startOfDayMs(dayMs);
  const override = (schedule.dayOverrides ?? []).find(
    (o) => !o.deletedAt && startOfDayMs(o.date) === d0
  );
  if (override) return override.status;
  const wd = new Date(d0).getDay();
  if ((schedule.closedWeekdays ?? []).includes(wd)) return 'closed';
  if ((schedule.singleServiceWeekdays ?? []).includes(wd)) return 'single';
  return 'open';
}

export function isClosedDay(dayMs: number, schedule: DaySchedule): boolean {
  return dayStatus(dayMs, schedule) === 'closed';
}

export function isSingleServiceDay(dayMs: number, schedule: DaySchedule): boolean {
  return dayStatus(dayMs, schedule) === 'single';
}
