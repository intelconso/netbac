import { addDays, addMonths } from 'date-fns';
import { PestCadence, PestControlCheck } from '../types';

// Cadence du contrôle nuisibles — pilote le calcul de "Prochain contrôle" et
// le statut de la carte. Choisi en Réglages, défaut hebdomadaire.
export const PEST_CADENCES: { value: PestCadence; label: string }[] = [
  { value: 'weekly', label: 'Hebdomadaire' },
  { value: 'biweekly', label: 'Toutes les 2 semaines' },
  { value: 'monthly', label: 'Mensuelle' },
  { value: 'quarterly', label: 'Trimestrielle' },
];

export function cadenceLabel(cadence?: PestCadence): string {
  return PEST_CADENCES.find((c) => c.value === (cadence ?? 'weekly'))?.label ?? 'Hebdomadaire';
}

// Prochaine échéance à partir d'une date de passage et de la cadence.
export function nextCheckFrom(timestamp: number, cadence?: PestCadence): number {
  switch (cadence ?? 'weekly') {
    case 'biweekly': return addDays(timestamp, 14).getTime();
    case 'monthly': return addMonths(timestamp, 1).getTime();
    case 'quarterly': return addMonths(timestamp, 3).getTime();
    case 'weekly':
    default: return addDays(timestamp, 7).getTime();
  }
}

// Libellé du/des types d'intervention pour l'affichage.
export function interventionLabel(types: PestControlCheck['interventionTypes']): string {
  const parts: string[] = [];
  if (types?.includes('deratisation')) parts.push('Dératisation');
  if (types?.includes('desinsectisation')) parts.push('Désinsectisation');
  return parts.join(' + ') || 'Passage';
}

const startOfDay = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

export interface PestStatus {
  // none : aucun passage enregistré — à programmer.
  // ok : prochain contrôle dans le futur.
  // due : prochain contrôle aujourd'hui.
  // overdue : prochain contrôle dépassé.
  state: 'none' | 'ok' | 'due' | 'overdue';
  nextDue?: number;
  lastAt?: number;
}

// Statut de la carte "Lutte contre les nuisibles" — basé sur le dernier passage
// et sa prochaine échéance (granularité jour).
export function pestStatus(checks: PestControlCheck[], cadence: PestCadence | undefined, now: number): PestStatus {
  const live = checks.filter((c) => !c.deletedAt).sort((a, b) => b.timestamp - a.timestamp);
  if (live.length === 0) return { state: 'none' };
  const last = live[0];
  const nextDue = last.nextCheck ?? nextCheckFrom(last.timestamp, cadence);
  const today = startOfDay(now);
  const due = startOfDay(nextDue);
  const state = today > due ? 'overdue' : today === due ? 'due' : 'ok';
  return { state, nextDue, lastAt: last.timestamp };
}
