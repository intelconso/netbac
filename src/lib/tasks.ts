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
import { ServiceSlot, Task, TaskCompletion, TaskFrequency, TaskPhoto } from '../types';
import { DaySchedule, dayStatus, startOfDayMs, WEEKDAYS } from './serviceDays';

export const TASK_FREQUENCIES: { value: TaskFrequency; label: string }[] = [
  { value: 'daily', label: 'Chaque jour' },
  { value: 'perService', label: 'Chaque service' },
  { value: 'weekdays', label: 'Jours choisis' },
  { value: 'monthly', label: 'Chaque mois' },
  { value: 'once', label: 'Ponctuelle' },
];

export const SERVICE_LABELS: Record<ServiceSlot, string> = {
  debut: 'Début de service',
  fin: 'Fin de service',
};

export const SERVICE_SHORT: Record<ServiceSlot, string> = {
  debut: 'Début',
  fin: 'Fin',
};

// Les services attendus une journée donnée. C'est le planning qui décide du
// nombre de passages, pas la tâche : un jour à service unique n'en attend qu'un,
// un jour fermé aucun. Même lecture que les relevés de température.
export function servicesFor(dayMs: number, schedule: DaySchedule): ServiceSlot[] {
  switch (dayStatus(dayMs, schedule)) {
    case 'closed':
      return [];
    case 'single':
      return ['debut'];
    default:
      return ['debut', 'fin'];
  }
}

// Id déterministe d'un cochage : deux appareils qui cochent la même tâche le
// même jour convergent sur un seul enregistrement au lieu d'en créer deux.
// Même principe que dayOverrideId() pour les exceptions de planning.
//
// Le service n'entre dans l'id que pour une tâche « chaque service » — sans
// suffixe, l'id est exactement celui d'avant la fonctionnalité, donc aucun
// cochage déjà enregistré ne change d'identité.
export function taskCompletionId(taskId: string, dayMs: number, service?: ServiceSlot): string {
  const base = `${taskId}-${startOfDayMs(dayMs)}`;
  return service ? `${base}-${service}` : base;
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
    case 'perService':
      return 'Chaque service';
    case 'monthly':
      return `Le ${task.monthDay ?? 1} du mois`;
    case 'once':
    default:
      return 'Ponctuelle';
  }
}

// Le cochage vivant d'une tâche pour une journée (et un service) donnés.
export function completionFor(
  taskId: string,
  dayMs: number,
  completions: TaskCompletion[],
  service?: ServiceSlot
): TaskCompletion | undefined {
  const id = taskCompletionId(taskId, dayMs, service);
  return completions.find((c) => c.id === id && !c.deletedAt);
}

// La tâche est-elle attendue ce jour-là ? Ne regarde que sa récurrence — le
// planning de service est appliqué par dueTasksFor().
export function isTaskDueOn(task: Task, dayMs: number, completions: TaskCompletion[]): boolean {
  if (task.deletedAt) return false;
  const d0 = startOfDayMs(dayMs);
  switch (task.frequency) {
    case 'daily':
    // Attendue tous les jours de service ; c'est dueTasksFor() qui la dédouble
    // en un passage par service.
    case 'perService':
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

// Un passage attendu : une tâche, et pour une tâche « chaque service » le
// service concerné. `key` est l'id du cochage correspondant — l'écran s'en sert
// comme clé de liste, puisqu'une même tâche peut apparaître deux fois.
export interface TaskInstance {
  task: Task;
  service?: ServiceSlot;
  key: string;
}

// Les passages attendus ce jour-là, dans l'ordre réglé par l'admin.
// Jour fermé → aucun : le restaurant n'est jamais "en retard" un jour de
// fermeture, exactement comme pour les contrôles du registre.
//
// Une tâche « chaque service » est dédoublée ici (début + fin) plutôt que dans
// l'écran : c'est le planning qui dicte le nombre de passages, et un jour à
// service unique n'en attend qu'un seul.
export function dueTasksFor(
  dayMs: number,
  tasks: Task[],
  completions: TaskCompletion[],
  schedule: DaySchedule
): TaskInstance[] {
  const services = servicesFor(dayMs, schedule);
  if (services.length === 0) return [];
  return tasks
    .filter((t) => !t.deletedAt && isTaskDueOn(t, dayMs, completions))
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .flatMap((task) =>
      task.frequency === 'perService'
        ? services.map((service) => ({ task, service, key: taskCompletionId(task.id, dayMs, service) }))
        : [{ task, key: taskCompletionId(task.id, dayMs) }]
    );
}

// La file d'un employé pour un pas-à-pas : d'abord ce qui lui est attribué,
// puis ce qui n'est attribué à personne — ces tâches-là attendent n'importe qui.
// Ce qui est attribué à QUELQU'UN D'AUTRE reste dehors : c'est sa tournée, pas
// la nôtre. Rien n'est verrouillé pour autant — la vue liste garde tout à portée
// de clic, l'attribution n'étant qu'une indication (voir Task.assigneeId).
//
// L'ordre réglé par l'admin est conservé à l'intérieur de chaque groupe.
export function queueForEmployee(
  instances: TaskInstance[],
  employeeId?: string
): TaskInstance[] {
  const mine = employeeId
    ? instances.filter((i) => i.task.assigneeId === employeeId)
    : [];
  const unassigned = instances.filter((i) => !i.task.assigneeId);
  return [...mine, ...unassigned];
}

// Point de reprise naturel d'un pas-à-pas : le premier passage pas encore
// coché. Tout fait → on revient au début plutôt que de sortir de la file.
export function firstPendingIndex(
  queue: TaskInstance[],
  dayMs: number,
  completions: TaskCompletion[]
): number {
  const idx = queue.findIndex((i) => !completionFor(i.task.id, dayMs, completions, i.service));
  return idx < 0 ? 0 : idx;
}

// Nombre de passages restant à faire — alimente le badge de la tuile Tâches.
// Une tâche « chaque service » non faite compte donc pour deux un jour ouvert.
export function pendingTaskCount(
  dayMs: number,
  tasks: Task[],
  completions: TaskCompletion[],
  schedule: DaySchedule
): number {
  return dueTasksFor(dayMs, tasks, completions, schedule).filter(
    ({ task, service }) => !completionFor(task.id, dayMs, completions, service)
  ).length;
}

// Les photos jointes à un cochage, les plus anciennes d'abord — l'ordre dans
// lequel elles ont été prises raconte le déroulé de la tâche.
//
// Le lien passe par `completionId` (déterministe, voir taskCompletionId) et non
// par une référence à l'objet : décocher tombstone la complétion mais ne touche
// pas aux photos, donc recocher le même jour les retrouve toutes.
export function photosForCompletion(
  taskId: string,
  dayMs: number,
  photos: TaskPhoto[],
  service?: ServiceSlot
): TaskPhoto[] {
  const id = taskCompletionId(taskId, dayMs, service);
  return photos
    .filter((p) => p.completionId === id)
    .sort((a, b) => a.capturedAt - b.capturedAt);
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
