// Checklist d'équipe — tâches définies par l'admin, cochées par les employés.
// Deux entités : la définition (récurrence) et le cochage (qui / quand), ce
// dernier snapshottant libellé et nom pour survivre à une suppression.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStore } from '../src/lib/store';
import {
  completionFor,
  dueTasksFor,
  frequencyLabel,
  isTaskDueOn,
  lastTaskEmployeeId,
  firstPendingIndex,
  monthlyDueDate,
  pendingTaskCount,
  photosForCompletion,
  queueForEmployee,
  servicesFor,
  taskCompletionId,
} from '../src/lib/tasks';
import { Task, TaskCompletion, TaskPhoto } from '../src/types';

const initialState = useStore.getState();

beforeEach(async () => {
  await AsyncStorage.clear();
  useStore.setState(initialState, true);
  useStore.persist.setOptions({ name: 'netbac-storage' });
});

// Fabrique une définition de tâche sans passer par le store.
const mkTask = (over: Partial<Task> = {}): Task => ({
  id: 't1',
  label: 'Sortir les poubelles',
  frequency: 'daily',
  order: 0,
  modifiedAt: 1,
  ...over,
});

const NO_SCHEDULE = {};
// 2026-08-20 est un jeudi (getDay() === 4).
const THU = new Date(2026, 7, 20, 10, 0, 0).getTime();
const FRI = new Date(2026, 7, 21, 10, 0, 0).getTime();

describe('récurrence', () => {
  it('quotidienne : attendue tous les jours', () => {
    const t = mkTask({ frequency: 'daily' });
    expect(isTaskDueOn(t, THU, [])).toBe(true);
    expect(isTaskDueOn(t, FRI, [])).toBe(true);
  });

  it('jours choisis : uniquement les jours cochés', () => {
    const t = mkTask({ frequency: 'weekdays', weekdays: [4] }); // jeudi
    expect(isTaskDueOn(t, THU, [])).toBe(true);
    expect(isTaskDueOn(t, FRI, [])).toBe(false);
  });

  it('mensuelle : le jour réglé, et seulement lui', () => {
    const t = mkTask({ frequency: 'monthly', monthDay: 20 });
    expect(isTaskDueOn(t, THU, [])).toBe(true);
    expect(isTaskDueOn(t, FRI, [])).toBe(false);
  });

  it('mensuelle réglée au 31 : clampée au dernier jour du mois court', () => {
    // Février 2026 compte 28 jours — une tâche au 31 tombe le 28, pas jamais.
    const feb28 = new Date(2026, 1, 28, 9, 0, 0).getTime();
    const feb27 = new Date(2026, 1, 27, 9, 0, 0).getTime();
    expect(monthlyDueDate(feb28, 31)).toBe(28);
    const t = mkTask({ frequency: 'monthly', monthDay: 31 });
    expect(isTaskDueOn(t, feb28, [])).toBe(true);
    expect(isTaskDueOn(t, feb27, [])).toBe(false);
    // Un mois de 31 jours garde bien le 31.
    expect(monthlyDueDate(new Date(2026, 0, 15).getTime(), 31)).toBe(31);
  });

  it('ponctuelle : attendue tant qu\'elle n\'est pas faite, puis seulement son jour', () => {
    const t = mkTask({ frequency: 'once' });
    expect(isTaskDueOn(t, THU, [])).toBe(true);
    useStore.setState({ tasks: [t] });
    useStore.getState().completeTask('t1', { operatorName: 'Ahmed' }, { dayKey: THU });
    const done = useStore.getState().taskCompletions;
    // Elle reste visible (dans "Faites") le jour du cochage…
    expect(isTaskDueOn(t, THU, done)).toBe(true);
    // …puis quitte définitivement la liste.
    expect(isTaskDueOn(t, FRI, done)).toBe(false);
  });

  it('libellé de récurrence lisible', () => {
    expect(frequencyLabel(mkTask({ frequency: 'daily' }))).toBe('Chaque jour');
    expect(frequencyLabel(mkTask({ frequency: 'weekdays', weekdays: [1, 4] }))).toBe('Lun · Jeu');
    expect(frequencyLabel(mkTask({ frequency: 'monthly', monthDay: 3 }))).toBe('Le 3 du mois');
    expect(frequencyLabel(mkTask({ frequency: 'once' }))).toBe('Ponctuelle');
  });
});

describe('planning de service', () => {
  it('jour fermé : aucune tâche attendue', () => {
    const tasks = [mkTask()];
    // Jeudi fermé de façon récurrente.
    const schedule = { closedWeekdays: [4] };
    expect(dueTasksFor(THU, tasks, [], schedule)).toEqual([]);
    expect(pendingTaskCount(THU, tasks, [], schedule)).toBe(0);
    // Le vendredi reste ouvert.
    expect(dueTasksFor(FRI, tasks, [], schedule)).toHaveLength(1);
  });

  it('service unique : les tâches restent attendues comme un jour ouvert', () => {
    const tasks = [mkTask()];
    expect(dueTasksFor(THU, tasks, [], { singleServiceWeekdays: [4] })).toHaveLength(1);
  });

  it('exception ponctuelle : prime sur le défaut hebdomadaire', () => {
    const tasks = [mkTask()];
    const schedule = {
      closedWeekdays: [] as number[],
      dayOverrides: [{ date: THU, status: 'closed' as const }],
    };
    expect(dueTasksFor(THU, tasks, [], schedule)).toEqual([]);
  });

  it('trie par ordre puis par libellé', () => {
    const tasks = [
      mkTask({ id: 'b', label: 'Balayer', order: 2 }),
      mkTask({ id: 'a', label: 'Hotte', order: 1 }),
    ];
    expect(dueTasksFor(THU, tasks, [], NO_SCHEDULE).map((i) => i.task.id)).toEqual(['a', 'b']);
  });
});

describe('cochage', () => {
  const seed = () => {
    useStore.getState().addTask({ label: 'Nettoyer la hotte', frequency: 'daily' });
    return useStore.getState().tasks[0].id;
  };

  it('enregistre qui a fait quoi, avec un id déterministe', () => {
    const id = seed();
    useStore.getState().completeTask(id, { operatorName: 'Ahmed', employeeId: 'e1' }, { dayKey: THU });
    const [c] = useStore.getState().taskCompletions;
    expect(c.id).toBe(taskCompletionId(id, THU));
    expect(c.operatorName).toBe('Ahmed');
    expect(c.taskLabel).toBe('Nettoyer la hotte');
    expect(c.employeeId).toBe('e1');
  });

  it('recocher le même jour ne crée pas de doublon', () => {
    const id = seed();
    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU });
    useStore.getState().completeTask(id, { operatorName: 'Sofia' }, { dayKey: THU });
    expect(useStore.getState().taskCompletions).toHaveLength(1);
    expect(useStore.getState().taskCompletions[0].operatorName).toBe('Sofia');
  });

  it('décocher pose un tombstone ; recocher réveille le même enregistrement', () => {
    const id = seed();
    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU });
    useStore.getState().uncompleteTask(id, THU);
    expect(useStore.getState().taskCompletions[0].deletedAt).toBeGreaterThan(0);
    expect(completionFor(id, THU, useStore.getState().taskCompletions)).toBeUndefined();

    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU });
    expect(useStore.getState().taskCompletions).toHaveLength(1);
    expect(useStore.getState().taskCompletions[0].deletedAt).toBeUndefined();
  });

  it('un cochage ne vaut que pour sa journée', () => {
    const id = seed();
    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU });
    const done = useStore.getState().taskCompletions;
    expect(completionFor(id, THU, done)).toBeDefined();
    expect(completionFor(id, FRI, done)).toBeUndefined();
  });

  it('ignore une tâche inconnue', () => {
    useStore.getState().completeTask('nope', { operatorName: 'Ahmed' });
    expect(useStore.getState().taskCompletions).toHaveLength(0);
  });

  it('pendingTaskCount suit le badge du tableau de bord', () => {
    const id = seed();
    useStore.getState().addTask({ label: 'Poubelles', frequency: 'daily' });
    const { tasks } = useStore.getState();
    expect(pendingTaskCount(THU, tasks, [], NO_SCHEDULE)).toBe(2);
    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU });
    expect(pendingTaskCount(THU, tasks, useStore.getState().taskCompletions, NO_SCHEDULE)).toBe(1);
  });
});

describe('snapshots — l\'historique survit aux suppressions', () => {
  it('garde libellé et nom après suppression de la tâche et de l\'employé', () => {
    useStore.getState().addEmployee({ name: 'Ahmed', role: 'Cuisine' });
    const empId = useStore.getState().employees[0].id;
    useStore.getState().addTask({ label: 'Nettoyer la hotte', frequency: 'daily' });
    const taskId = useStore.getState().tasks[0].id;
    useStore.getState().completeTask(taskId, { operatorName: 'Ahmed', employeeId: empId }, { dayKey: THU });

    useStore.getState().deleteTask(taskId);
    useStore.getState().deleteEmployee(empId);

    const [c] = useStore.getState().taskCompletions;
    expect(c.deletedAt).toBeUndefined();
    expect(c.taskLabel).toBe('Nettoyer la hotte');
    expect(c.operatorName).toBe('Ahmed');
    // La tâche supprimée quitte bien la liste du jour.
    expect(dueTasksFor(THU, useStore.getState().tasks, [], NO_SCHEDULE)).toEqual([]);
  });
});

describe('équipe', () => {
  it('ajoute, renomme et supprime en tombstone', () => {
    useStore.getState().addEmployee({ name: '  Ahmed  ', role: ' Cuisine ' });
    useStore.getState().addEmployee({ name: '   ' });
    expect(useStore.getState().employees).toHaveLength(1);
    const [e] = useStore.getState().employees;
    expect(e.name).toBe('Ahmed');
    expect(e.role).toBe('Cuisine');

    useStore.getState().updateEmployee(e.id, { name: 'Ahmed B.' });
    expect(useStore.getState().employees[0].name).toBe('Ahmed B.');

    useStore.getState().deleteEmployee(e.id);
    expect(useStore.getState().employees[0].deletedAt).toBeGreaterThan(0);
  });

  it('pré-sélectionne le dernier employé à avoir coché', () => {
    const completions: TaskCompletion[] = [
      { id: 'a', taskId: 't', taskLabel: 'x', dayKey: 1, timestamp: 100, employeeId: 'e1', operatorName: 'A', modifiedAt: 100 },
      { id: 'b', taskId: 't', taskLabel: 'x', dayKey: 2, timestamp: 300, employeeId: 'e2', operatorName: 'B', modifiedAt: 300 },
      { id: 'c', taskId: 't', taskLabel: 'x', dayKey: 3, timestamp: 500, employeeId: 'e3', operatorName: 'C', modifiedAt: 500, deletedAt: 600 },
    ];
    expect(lastTaskEmployeeId(completions)).toBe('e2');
    expect(lastTaskEmployeeId([])).toBeUndefined();
  });
});

describe('ordre des tâches', () => {
  it('monte et descend une tâche, sans déborder', () => {
    ['A', 'B', 'C'].forEach((label) => useStore.getState().addTask({ label, frequency: 'daily' }));
    const ids = useStore.getState().tasks.map((t) => t.id);
    const order = () => useStore.getState().tasks.slice().sort((a, b) => a.order - b.order).map((t) => t.label);

    expect(order()).toEqual(['A', 'B', 'C']);
    useStore.getState().moveTask(ids[2], 'up');
    expect(order()).toEqual(['A', 'C', 'B']);
    useStore.getState().moveTask(ids[0], 'up'); // déjà en haut — sans effet
    expect(order()).toEqual(['A', 'C', 'B']);
    useStore.getState().moveTask(ids[0], 'down');
    expect(order()).toEqual(['C', 'A', 'B']);
  });
});

// « Chaque service » — un passage par service, le planning décidant du nombre.
describe('tâches par service', () => {
  const perService = mkTask({ id: 'ps', label: 'Balayer la salle', frequency: 'perService' });

  it('rend les services attendus selon le planning', () => {
    expect(servicesFor(THU, NO_SCHEDULE)).toEqual(['debut', 'fin']);
    expect(servicesFor(THU, { singleServiceWeekdays: [4] })).toEqual(['debut']);
    expect(servicesFor(THU, { closedWeekdays: [4] })).toEqual([]);
  });

  it('dédouble la tâche un jour ouvert, une seule fois un jour à service unique', () => {
    const open = dueTasksFor(THU, [perService], [], NO_SCHEDULE);
    expect(open.map((i) => i.service)).toEqual(['debut', 'fin']);
    // Deux passages distincts : deux clés, donc deux cases à cocher.
    expect(new Set(open.map((i) => i.key)).size).toBe(2);

    const single = dueTasksFor(THU, [perService], [], { singleServiceWeekdays: [4] });
    expect(single.map((i) => i.service)).toEqual(['debut']);

    expect(dueTasksFor(THU, [perService], [], { closedWeekdays: [4] })).toEqual([]);
  });

  it('laisse les autres récurrences à un seul passage, sans service', () => {
    const due = dueTasksFor(THU, [mkTask({ frequency: 'daily' })], [], NO_SCHEDULE);
    expect(due).toHaveLength(1);
    expect(due[0].service).toBeUndefined();
    // L'id du cochage est inchangé par rapport à avant la fonctionnalité.
    expect(due[0].key).toBe(taskCompletionId('t1', THU));
  });

  it('coche chaque service séparément', () => {
    useStore.getState().addTask({ label: 'Balayer', frequency: 'perService' });
    const id = useStore.getState().tasks[0].id;
    const schedule = NO_SCHEDULE;

    expect(pendingTaskCount(THU, useStore.getState().tasks, [], schedule)).toBe(2);

    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU, service: 'debut' });
    let done = useStore.getState().taskCompletions;
    expect(done).toHaveLength(1);
    expect(done[0].id).toBe(taskCompletionId(id, THU, 'debut'));
    expect(done[0].service).toBe('debut');
    expect(completionFor(id, THU, done, 'debut')).toBeDefined();
    expect(completionFor(id, THU, done, 'fin')).toBeUndefined();
    expect(pendingTaskCount(THU, useStore.getState().tasks, done, schedule)).toBe(1);

    useStore.getState().completeTask(id, { operatorName: 'Sofia' }, { dayKey: THU, service: 'fin' });
    done = useStore.getState().taskCompletions;
    expect(done).toHaveLength(2);
    expect(pendingTaskCount(THU, useStore.getState().tasks, done, schedule)).toBe(0);

    // Décocher un service ne touche pas à l'autre.
    useStore.getState().uncompleteTask(id, THU, 'debut');
    done = useStore.getState().taskCompletions;
    expect(completionFor(id, THU, done, 'debut')).toBeUndefined();
    expect(completionFor(id, THU, done, 'fin')).toBeDefined();
  });

  it("ignore un service passé à une tâche qui n'est pas par service", () => {
    useStore.getState().addTask({ label: 'Poubelles', frequency: 'daily' });
    const id = useStore.getState().tasks[0].id;
    // Un service porté ici scinderait un seul passage en deux enregistrements.
    useStore.getState().completeTask(id, { operatorName: 'Ahmed' }, { dayKey: THU, service: 'fin' });
    const [c] = useStore.getState().taskCompletions;
    expect(c.id).toBe(taskCompletionId(id, THU));
    expect(c.service).toBeUndefined();
  });

  it('range les photos par service', () => {
    useStore.getState().addTask({ label: 'Balayer', frequency: 'perService' });
    const id = useStore.getState().tasks[0].id;
    const a = useStore.getState().addTaskPhoto({ taskId: id, dayKey: THU, service: 'debut', operatorName: 'Ahmed' });
    useStore.getState().addTaskPhoto({ taskId: id, dayKey: THU, service: 'fin', operatorName: 'Sofia' });

    const photos = useStore.getState().taskPhotos;
    expect(photosForCompletion(id, THU, photos, 'debut').map((p) => p.id)).toEqual([a]);
    expect(photosForCompletion(id, THU, photos, 'fin')).toHaveLength(1);
    // Sans service, on ne ramasse aucune des deux : l'id ne correspond pas.
    expect(photosForCompletion(id, THU, photos)).toEqual([]);
  });
});

// Photos de cochage — le témoignage que la tâche a bien été faite. Entité de
// premier niveau (pas un champ de TaskCompletion) pour survivre à la fusion
// cloud, et sans deletedAt : une preuve ne s'efface pas.
describe('photos de tâches', () => {
  const mkPhoto = (over: Partial<TaskPhoto> = {}): TaskPhoto => ({
    id: 'p1',
    completionId: taskCompletionId('t1', THU),
    taskId: 't1',
    dayKey: THU,
    capturedAt: 1000,
    operatorName: 'Sam',
    modifiedAt: 1000,
    ...over,
  });

  it('rend les photos du cochage visé, les plus anciennes en premier', () => {
    const photos = [
      mkPhoto({ id: 'b', capturedAt: 2000 }),
      mkPhoto({ id: 'a', capturedAt: 1000 }),
      // Autre jour, même tâche — ne doit pas remonter.
      mkPhoto({ id: 'c', completionId: taskCompletionId('t1', FRI), dayKey: FRI }),
      // Autre tâche, même jour — non plus.
      mkPhoto({ id: 'd', completionId: taskCompletionId('t2', THU), taskId: 't2' }),
    ];
    expect(photosForCompletion('t1', THU, photos).map((p) => p.id)).toEqual(['a', 'b']);
    expect(photosForCompletion('t1', THU, [])).toEqual([]);
  });

  it("accepte n'importe quelle heure de la journée visée", () => {
    const photos = [mkPhoto()];
    const sameDayEvening = new Date(2026, 7, 20, 23, 30).getTime();
    expect(photosForCompletion('t1', sameDayEvening, photos)).toHaveLength(1);
  });

  it('attache la photo au cochage du jour et la garde après un décochage', () => {
    const store = useStore.getState();
    store.addTask({ label: 'Nettoyer la hotte', frequency: 'daily' });
    const taskId = useStore.getState().tasks[0].id;

    store.completeTask(taskId, { operatorName: 'Sam' }, { dayKey: THU });
    const photoId = useStore.getState().addTaskPhoto({ taskId, dayKey: THU, operatorName: 'Sam' });

    const attached = photosForCompletion(taskId, THU, useStore.getState().taskPhotos);
    expect(attached.map((p) => p.id)).toEqual([photoId]);
    expect(attached[0].completionId).toBe(taskCompletionId(taskId, THU));
    // Pas encore envoyée : aucune URL tant que la file n'a pas tourné.
    expect(attached[0].url).toBeUndefined();

    // Décocher tombstone la complétion mais ne touche pas à la preuve, donc
    // recocher le même jour la retrouve.
    useStore.getState().uncompleteTask(taskId, THU);
    expect(photosForCompletion(taskId, THU, useStore.getState().taskPhotos)).toHaveLength(1);
    useStore.getState().completeTask(taskId, { operatorName: 'Alex' }, { dayKey: THU });
    expect(photosForCompletion(taskId, THU, useStore.getState().taskPhotos)).toHaveLength(1);
  });

  it("écrit l'URL Cloudinary sur la photo une fois envoyée", () => {
    const store = useStore.getState();
    store.addTask({ label: 'Hotte', frequency: 'daily' });
    const taskId = useStore.getState().tasks[0].id;
    const id = store.addTaskPhoto({ taskId, dayKey: THU, operatorName: 'Sam' });

    useStore.getState().setTaskPhotoUrl(id, 'https://res.cloudinary.com/x/a.jpg');
    expect(useStore.getState().taskPhotos.find((p) => p.id === id)?.url)
      .toBe('https://res.cloudinary.com/x/a.jpg');
  });

  it('empile plusieurs photos sur un même cochage, sans écrasement', () => {
    const store = useStore.getState();
    store.addTask({ label: 'Hotte', frequency: 'daily' });
    const taskId = useStore.getState().tasks[0].id;
    const a = store.addTaskPhoto({ taskId, dayKey: THU, operatorName: 'Sam' });
    const b = useStore.getState().addTaskPhoto({ taskId, dayKey: THU, operatorName: 'Alex' });

    expect(a).not.toBe(b);
    expect(photosForCompletion(taskId, THU, useStore.getState().taskPhotos)).toHaveLength(2);
  });

  it("garde une entrée de file d'attente par photo, contrairement aux produits", () => {
    const store = useStore.getState();
    store.enqueueTaskPhotoUpload('p1', 'file:///a.jpg');
    useStore.getState().enqueueTaskPhotoUpload('p2', 'file:///b.jpg');
    expect(useStore.getState().pendingPhotos).toHaveLength(2);
    expect(useStore.getState().pendingPhotos.every((p) => p.kind === 'task')).toBe(true);

    // Un produit garde son entrée unique : les deux genres cohabitent.
    useStore.getState().enqueuePendingPhoto('prod1', 'file:///c.jpg');
    useStore.getState().enqueuePendingPhoto('prod1', 'file:///d.jpg');
    expect(useStore.getState().pendingPhotos).toHaveLength(3);

    useStore.getState().removeTaskPhotoUpload('p1');
    expect(useStore.getState().pendingPhotos.map((p) => p.taskPhotoId)).toEqual([
      'p2', undefined,
    ]);
  });
});

// Pas-à-pas — la tournée d'une personne : on demande « qui êtes-vous ? » une
// fois, puis on déroule sa file au lieu de redemander le nom à chaque cochage.
describe('file du pas-à-pas', () => {
  const inst = (task: Task) => ({ task, key: taskCompletionId(task.id, THU) });
  const mine = mkTask({ id: 'm', label: 'Hotte', assigneeId: 'e1', order: 3 });
  const theirs = mkTask({ id: 'o', label: 'Cave', assigneeId: 'e2', order: 1 });
  const free = mkTask({ id: 'f', label: 'Poubelles', order: 2 });
  const all = [mine, theirs, free].map(inst);

  it("met les tâches attribuées d'abord, puis celles qui n'attendent personne", () => {
    // Attribuée à e1 avant la libre, même si l'admin l'a classée après : dans
    // une tournée, ce qui vous revient passe en premier.
    expect(queueForEmployee(all, 'e1').map((i) => i.task.id)).toEqual(['m', 'f']);
  });

  it("laisse dehors ce qui est attribué à quelqu'un d'autre", () => {
    expect(queueForEmployee(all, 'e1').map((i) => i.task.id)).not.toContain('o');
    expect(queueForEmployee(all, 'e2').map((i) => i.task.id)).toEqual(['o', 'f']);
  });

  it('sans personne choisie, ne garde que les tâches libres', () => {
    expect(queueForEmployee(all, undefined).map((i) => i.task.id)).toEqual(['f']);
  });

  it('garde les deux passages d\'une tâche par service', () => {
    const perService = mkTask({ id: 'ps', frequency: 'perService', assigneeId: 'e1' });
    const due = dueTasksFor(THU, [perService], [], NO_SCHEDULE);
    expect(queueForEmployee(due, 'e1').map((i) => i.service)).toEqual(['debut', 'fin']);
  });

  it('reprend au premier passage non coché', () => {
    const queue = queueForEmployee(all, 'e1');
    expect(firstPendingIndex(queue, THU, [])).toBe(0);

    const doneFirst: TaskCompletion[] = [{
      id: taskCompletionId('m', THU), taskId: 'm', taskLabel: 'Hotte',
      dayKey: THU, timestamp: 1, operatorName: 'A', modifiedAt: 1,
    }];
    expect(firstPendingIndex(queue, THU, doneFirst)).toBe(1);

    // Tout fait : on revient au début plutôt que de sortir de la file.
    const allDone: TaskCompletion[] = [...doneFirst, {
      id: taskCompletionId('f', THU), taskId: 'f', taskLabel: 'Poubelles',
      dayKey: THU, timestamp: 2, operatorName: 'A', modifiedAt: 2,
    }];
    expect(firstPendingIndex(queue, THU, allDone)).toBe(0);
    expect(firstPendingIndex([], THU, [])).toBe(0);
  });
});
