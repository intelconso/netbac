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
  monthlyDueDate,
  pendingTaskCount,
  taskCompletionId,
} from '../src/lib/tasks';
import { Task, TaskCompletion } from '../src/types';

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
    expect(dueTasksFor(THU, tasks, [], NO_SCHEDULE).map((t) => t.id)).toEqual(['a', 'b']);
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
