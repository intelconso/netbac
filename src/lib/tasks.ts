// Checklist d'équipe — le travail quotidien non réglementaire du restaurant
// (poubelles, hotte, stocks…), par opposition aux contrôles HACCP du registre.
//
// Deux entités : `Task` est la définition posée par l'admin (libellé +
// récurrence), `TaskCompletion` l'enregistrement d'un cochage. Le cochage
// snapshotte le libellé et le nom, donc supprimer une tâche ou un employé
// n'efface jamais l'historique — même principe que les contrôles du registre.
//
// Le planning de service prime sur tout : un jour fermé n'attend aucune tâche.

import { endOfMonth, getDate, getDay } from 'date-fns';
import { Task, TaskCompletion, TaskFrequency } from '../types';
import { DaySchedule, dayStatus, startOfDayMs, WEEKDAYS } from './serviceDays';

export const TASK_FREQUENCIES: { value: TaskFrequency; label: string }[] = [
  { value: 'daily', label: 'Chaque jour' },
  { value: 'weekdays', label: 'Jours choisis' },
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'once', label: 'Ponctuelle' },
];

// Id déterministe d'un cochage : deux appareils qui cochent la même tâche le
// même jour convergent sur un seul enregistrement au lieu d'en créer deux.
// Même principe que dayOverrideId() pour les exceptions de planning.
export function taskCompletionId(taskId: string, dayMs: number): string {
  return `${taskId}-${startOfDayMs(dayMs)}`;
}

// Jour du mois où tombe une tâche mensuelle, clampé à la fin du mois : réglée
// au 31, elle tombe le 28 (ou 29) en février au lieu d'être sautée.
export function monthlyDueDate(dayMs: number, monthDay?: number): number {
  const lastDay = getDate(endOfMonth(new Date(dayMs)));
  return Math.min(Math.max(monthDay ?? 1, 1), lastDay);
}

export function frequencyLabel(task: Pick<Task, 'frequency' | 'weekdays' | 'monthDay'>): string {
  switch (task.frequency) {
    case 'daily':
      return 'Chaque jour';
    case 'weekdays': {
      const picked = WEEKDAYS.filter((w) => (task.weekdays ?? []).includes(w.value));
      return picked.length ? picked.map((w) => w.short).join(' · ') : 'Aucun jour choisi';
    }
    case 'monthly':
      return `Le ${task.monthDay ?? 1} du mois`;
    case 'once':
    default:
      return 'Ponctuelle';
  }
}

// Le cochage vivant d'une tâche pour une journée donnée, s'il existe.
export function completionFor(
  taskId: string,
  dayMs: number,
  completions: TaskCompletion[]
): TaskCompletion | undefined {
  const id = taskCompletionId(taskId, dayMs);
  return completions.find((c) => c.id === id && !c.deletedAt);
}

// La tâche est-elle attendue ce jour-là ? Ne regarde que sa récurrence — le
// planning de service est appliqué par dueTasksFor().
export function isTaskDueOn(task: Task, dayMs: number, completions: TaskCompletion[]): boolean {
  if (task.deletedAt) return false;
  const d0 = startOfDayMs(dayMs);
  switch (task.frequency) {
    case 'daily':
      return true;
    case 'weekdays':
      return (task.weekdays ?? []).includes(getDay(new Date(d0)));
    case 'monthly':
      return getDate(new Date(d0)) === monthlyDueDate(d0, task.monthDay);
    case 'once': {
      // Ponctuelle : attendue tant qu'elle n'a jamais été faite. Le jour du
      // cochage elle reste affichée (dans "Faites"), puis quitte la liste.
      const done = completions.filter((c) => c.taskId === task.id && !c.deletedAt);
      if (done.length === 0) return true;
      return done.some((c) => c.dayKey === d0);
    }
    default:
      return false;
  }
}

// Les tâches attendues ce jour-là, dans l'ordre réglé par l'admin.
// Jour fermé → aucune tâche : le restaurant n'est jamais "en retard" un jour
// de fermeture, exactement comme pour les contrôles du registre.
export function dueTasksFor(
  dayMs: number,
  tasks: Task[],
  completions: TaskCompletion[],
  schedule: DaySchedule
): Task[] {
  if (dayStatus(dayMs, schedule) === 'closed') return [];
  return tasks
    .filter((t) => !t.deletedAt && isTaskDueOn(t, dayMs, completions))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

// Nombre de tâches restant à faire — alimente le badge de la tuile Tâches.
export function pendingTaskCount(
  dayMs: number,
  tasks: Task[],
  completions: TaskCompletion[],
  schedule: DaySchedule
): number {
  return dueTasksFor(dayMs, tasks, completions, schedule).filter(
    (t) => !completionFor(t.id, dayMs, completions)
  ).length;
}

// Dernier employé à avoir coché quelque chose — sert à pré-sélectionner son nom
// pour que le cochage reste un seul geste. Même intention que lastControllerName().
export function lastTaskEmployeeId(completions: TaskCompletion[]): string | undefined {
  let best: { t: number; id: string } | null = null;
  for (const c of completions) {
    if (c.deletedAt || !c.employeeId) continue;
    if (!best || c.timestamp > best.t) best = { t: c.timestamp, id: c.employeeId };
  }
  return best?.id;
}
