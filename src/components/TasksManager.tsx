import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Bell, BellOff, ChevronDown, ChevronUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { WEEKDAYS } from '../lib/serviceDays';
import { TASK_FREQUENCIES, frequencyLabel } from '../lib/tasks';
import { TaskFrequency } from '../types';

// Heures proposées pour le rappel quotidien. Une liste courte suffit : le
// rappel sert à rattraper une checklist oubliée en fin de service, pas à
// programmer quoi que ce soit à la minute près.
const REMINDER_HOURS = [6, 8, 9, 10, 11, 14, 15, 16, 17, 18, 19, 20, 21, 22];

// Paramètres → Tâches : l'admin définit la checklist d'équipe (libellé +
// récurrence + ordre). Les cochages snapshotent le libellé, donc éditer ou
// supprimer une tâche ne casse jamais l'historique.
export default function TasksManager() {
  const tasks = useStore((s) => s.tasks);
  const employees = useStore((s) => s.employees);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const moveTask = useStore((s) => s.moveTask);
  const taskReminderHour = useStore((s) => s.taskReminderHour);
  const setTaskReminderHour = useStore((s) => s.setTaskReminderHour);

  const live = (tasks ?? []).filter((t) => !t.deletedAt).sort((a, b) => a.order - b.order);
  const liveEmployees = (employees ?? []).filter((e) => !e.deletedAt);

  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<TaskFrequency>('daily');
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthDay, setMonthDay] = useState('1');
  const [assigneeId, setAssigneeId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  const openBuilder = (taskId?: string) => {
    const t = taskId ? live.find((x) => x.id === taskId) : undefined;
    setEditingId(t ? t.id : 'new');
    setLabel(t?.label ?? '');
    setDescription(t?.description ?? '');
    setFrequency(t?.frequency ?? 'daily');
    setWeekdays(t?.weekdays ?? []);
    setMonthDay(String(t?.monthDay ?? 1));
    setAssigneeId(t?.assigneeId);
    setError(null);
  };

  const save = () => {
    const l = label.trim();
    if (!l) { setError('Donne un libellé à la tâche.'); return; }
    if (frequency === 'weekdays' && weekdays.length === 0) {
      setError('Choisis au moins un jour.');
      return;
    }
    const day = Math.min(Math.max(parseInt(monthDay, 10) || 1, 1), 31);
    const data = {
      label: l,
      ...(description.trim() ? { description: description.trim() } : {}),
      frequency,
      ...(frequency === 'weekdays' ? { weekdays: weekdays.slice().sort((a, b) => a - b) } : {}),
      ...(frequency === 'monthly' ? { monthDay: day } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };
    if (editingId === 'new') {
      addTask(data);
    } else if (editingId) {
      // Les champs propres aux autres récurrences sont explicitement remis à
      // undefined : sans ça, passer de "jours choisis" à "chaque jour"
      // laisserait un `weekdays` orphelin dans l'enregistrement.
      updateTask(editingId, {
        weekdays: undefined,
        monthDay: undefined,
        assigneeId: undefined,
        description: undefined,
        ...data,
      });
    }
    setEditingId(null);
    setError(null);
  };

  const employeeName = (id?: string) => liveEmployees.find((e) => e.id === id)?.name;

  if (editingId !== null) {
    return (
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Libellé</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="Ex. Sortir les poubelles, Nettoyer la hotte..."
            className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Précision (optionnel)</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Ex. Bacs jaunes côté cour"
            className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold"
          />
        </View>

        <View className="gap-2">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Récurrence</Text>
          <View className="flex-row flex-wrap gap-2">
            {TASK_FREQUENCIES.map((f) => (
              <Pressable
                key={f.value}
                onPress={() => setFrequency(f.value)}
                className={cn('px-3 py-2 rounded-xl border', frequency === f.value ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
              >
                <Text className={cn('text-[10px] font-bold uppercase', frequency === f.value ? 'text-primary' : 'text-gray-600')}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {frequency === 'weekdays' && (
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jours</Text>
            <View className="flex-row flex-wrap gap-2">
              {WEEKDAYS.map((w) => {
                const on = weekdays.includes(w.value);
                return (
                  <Pressable
                    key={w.value}
                    onPress={() => setWeekdays((ds) => (on ? ds.filter((d) => d !== w.value) : [...ds, w.value]))}
                    className={cn('px-3 py-2 rounded-xl border', on ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
                  >
                    <Text className={cn('text-[10px] font-bold uppercase', on ? 'text-primary' : 'text-gray-600')}>{w.short}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {frequency === 'monthly' && (
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jour du mois</Text>
            <TextInput
              value={monthDay}
              onChangeText={setMonthDay}
              keyboardType="number-pad"
              maxLength={2}
              className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold w-24"
            />
            <Text className="text-[10px] font-medium text-gray-400">
              Au-delà du dernier jour du mois, la tâche tombe le dernier jour (le 31 devient le 28 en février).
            </Text>
          </View>
        )}

        {liveEmployees.length > 0 && (
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Attribuée à (optionnel)</Text>
            <View className="flex-row flex-wrap gap-2">
              <Pressable
                onPress={() => setAssigneeId(undefined)}
                className={cn('px-3 py-2 rounded-xl border', !assigneeId ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
              >
                <Text className={cn('text-[10px] font-bold uppercase', !assigneeId ? 'text-primary' : 'text-gray-600')}>Tout le monde</Text>
              </Pressable>
              {liveEmployees.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => setAssigneeId(e.id)}
                  className={cn('px-3 py-2 rounded-xl border', assigneeId === e.id ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
                >
                  <Text className={cn('text-[10px] font-bold uppercase', assigneeId === e.id ? 'text-primary' : 'text-gray-600')}>{e.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-[10px] font-medium text-gray-400">
              Simple indication : n'importe qui peut cocher la tâche, et c'est le nom de la
              personne qui la fait réellement qui est enregistré.
            </Text>
          </View>
        )}

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-[10px] font-bold text-red-700">{error}</Text>
          </View>
        )}

        <View className="flex-row gap-2">
          <Pressable onPress={() => { setEditingId(null); setError(null); }} className="flex-1 py-3">
            <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
          </Pressable>
          <Pressable onPress={save} className="flex-1 py-3 bg-primary rounded-xl">
            <Text className="text-[10px] font-black uppercase text-center text-white">
              {editingId === 'new' ? 'Créer la tâche' : 'Enregistrer'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-3">
        {live.map((t, i) => {
          const assignee = employeeName(t.assigneeId);
          return (
            <View key={t.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
              <View className="gap-1">
                <Pressable
                  onPress={() => moveTask(t.id, 'up')}
                  disabled={i === 0}
                  className={cn('w-7 h-7 rounded-lg bg-gray-50 items-center justify-center', i === 0 && 'opacity-30')}
                >
                  <ChevronUp size={13} color="#9CA3AF" />
                </Pressable>
                <Pressable
                  onPress={() => moveTask(t.id, 'down')}
                  disabled={i === live.length - 1}
                  className={cn('w-7 h-7 rounded-lg bg-gray-50 items-center justify-center', i === live.length - 1 && 'opacity-30')}
                >
                  <ChevronDown size={13} color="#9CA3AF" />
                </Pressable>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{t.label}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {frequencyLabel(t)}{assignee ? ` • ${assignee}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => openBuilder(t.id)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                <Pencil size={14} color="#9CA3AF" />
              </Pressable>
              <Pressable
                onPress={() => setConfirmDelete({ id: t.id, label: t.label })}
                className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
              >
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            </View>
          );
        })}

        {live.length === 0 && (
          <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
            <ListChecks size={20} color="#D1D5DB" />
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              Aucune tâche — ajoutez-en une
            </Text>
          </View>
        )}
      </View>

      {confirmDelete && (
        <View className="bg-white p-4 rounded-2xl border border-red-200 gap-3">
          <Text className="text-[10px] font-bold text-gray-600 uppercase">
            Supprimer « {confirmDelete.label} » ? Les tâches déjà faites restent dans l'historique.
          </Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setConfirmDelete(null)} className="flex-1 py-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
            </Pressable>
            <Pressable
              onPress={() => { deleteTask(confirmDelete.id); setConfirmDelete(null); }}
              className="flex-1 py-3 bg-danger rounded-xl"
            >
              <Text className="text-[10px] font-black uppercase text-center text-white">Supprimer</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={() => openBuilder()} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
        <Plus size={14} color="#fff" />
        <Text className="text-[10px] font-black text-white uppercase">Nouvelle tâche</Text>
      </Pressable>

      <View className="gap-2 mt-2">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Rappel quotidien</Text>
        <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
          <View className="flex-row items-center gap-3">
            <View className={cn('w-10 h-10 rounded-xl items-center justify-center', taskReminderHour === undefined ? 'bg-gray-100' : 'bg-primary/10')}>
              {taskReminderHour === undefined
                ? <BellOff size={18} color="#9CA3AF" />
                : <Bell size={18} color="#10B981" />}
            </View>
            <Text className="flex-1 text-[11px] font-medium text-gray-500">
              {taskReminderHour === undefined
                ? 'Aucune notification.'
                : `Une notification à ${String(taskReminderHour).padStart(2, '0')}:00 s'il reste des tâches à faire. Silencieuse les jours de fermeture.`}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Pressable
              onPress={() => setTaskReminderHour(undefined)}
              className={cn('px-3 py-2 rounded-xl border', taskReminderHour === undefined ? 'bg-gray-700 border-gray-700' : 'bg-gray-50 border-gray-100')}
            >
              <Text className={cn('text-[10px] font-bold uppercase', taskReminderHour === undefined ? 'text-white' : 'text-gray-600')}>Aucun</Text>
            </Pressable>
            {REMINDER_HOURS.map((h) => (
              <Pressable
                key={h}
                onPress={() => setTaskReminderHour(h)}
                className={cn('px-3 py-2 rounded-xl border', taskReminderHour === h ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}
              >
                <Text className={cn('text-[10px] font-bold uppercase', taskReminderHour === h ? 'text-primary' : 'text-gray-600')}>
                  {String(h).padStart(2, '0')}h
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
