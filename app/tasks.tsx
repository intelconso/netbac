import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, CalendarOff, Check, History, ListChecks, RotateCcw, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useActiveStore } from '../src/lib/useActive';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import { dayStatus, startOfDayMs } from '../src/lib/serviceDays';
import { completionFor, dueTasksFor, frequencyLabel, lastTaskEmployeeId } from '../src/lib/tasks';
import { Task } from '../src/types';

// Checklist d'équipe — le travail quotidien non réglementaire, par opposition
// aux contrôles HACCP de l'écran Traçabilité. L'admin définit les tâches et
// leur récurrence dans Paramètres ; ici l'équipe les coche au fil du service.
//
// Chaque cochage enregistre qui l'a fait : l'app étant mono-compte (un login
// par restaurant), le nom vient de la liste Équipe, pas de l'authentification.
export default function TasksScreen() {
  const router = useRouter();
  const {
    tasks, taskCompletions, employees,
    closedWeekdays, singleServiceWeekdays, dayOverrides,
  } = useActiveStore();
  const completeTask = useStore((s) => s.completeTask);
  const uncompleteTask = useStore((s) => s.uncompleteTask);

  const today = startOfDayMs(Date.now());
  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };
  const closedToday = dayStatus(today, schedule) === 'closed';

  const due = useMemo(
    () => dueTasksFor(today, tasks, taskCompletions, schedule),
    [today, tasks, taskCompletions, closedWeekdays, singleServiceWeekdays, dayOverrides]
  );
  const doneOf = (t: Task) => completionFor(t.id, today, taskCompletions);
  const pending = due.filter((t) => !doneOf(t));
  const done = due.filter((t) => doneOf(t));

  // Feuille de cochage : on demande qui fait la tâche avant d'enregistrer.
  const [signing, setSigning] = useState<Task | null>(null);
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');

  const openSign = (task: Task) => {
    setSigning(task);
    // Pré-sélection : la personne visée par la tâche, sinon la dernière à avoir
    // coché quoi que ce soit — pour que le geste courant reste un seul tap.
    const last = lastTaskEmployeeId(taskCompletions);
    const suggested = task.assigneeId && employees.some((e) => e.id === task.assigneeId)
      ? task.assigneeId
      : (last && employees.some((e) => e.id === last) ? last : employees[0]?.id);
    setPickedId(suggested);
    setNote('');
  };

  const confirmSign = () => {
    if (!signing || !pickedId) return;
    const employee = employees.find((e) => e.id === pickedId);
    if (!employee) return;
    completeTask(signing.id, { employeeId: employee.id, operatorName: employee.name, notes: note }, { dayKey: today });
    setSigning(null);
  };

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
        <View className="flex-1">
          <Text className="text-sm font-black text-gray-900 uppercase">Tâches</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
            {format(new Date(), 'EEEE d MMMM', { locale: fr })}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/controls-history' as any)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
          <History size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 96, gap: 20 }}>
        {closedToday ? (
          <View className="bg-white p-8 rounded-3xl border border-gray-100 items-center gap-3">
            <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center">
              <CalendarOff size={26} color="#9CA3AF" />
            </View>
            <Text className="text-sm font-black text-gray-900 uppercase text-center">Restaurant fermé</Text>
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              Aucune tâche attendue aujourd'hui
            </Text>
          </View>
        ) : due.length === 0 ? (
          <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center gap-3">
            <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center">
              <ListChecks size={26} color="#D1D5DB" />
            </View>
            <Text className="text-sm font-black text-gray-900 uppercase text-center">Aucune tâche du jour</Text>
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              Ajoutez-en dans Paramètres → Personnalisation → Tâches
            </Text>
          </View>
        ) : (
          <>
            <View className={cn('p-5 rounded-3xl', pending.length === 0 && 'border border-gray-100')}
              style={{ backgroundColor: pending.length > 0 ? '#F59E0B' : '#FFFFFF' }}>
              <View className="flex-row items-center gap-4">
                <View
                  className="w-12 h-12 rounded-2xl items-center justify-center"
                  style={{ backgroundColor: pending.length > 0 ? 'rgba(255,255,255,0.2)' : 'rgba(16,185,129,0.1)' }}
                >
                  <ListChecks size={26} color={pending.length > 0 ? '#fff' : '#10B981'} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-black uppercase" style={{ color: pending.length > 0 ? '#fff' : '#111827' }}>
                    {done.length} / {due.length}
                  </Text>
                  <Text
                    className="text-[9px] font-bold uppercase tracking-widest mt-0.5"
                    style={{ color: pending.length > 0 ? 'rgba(255,255,255,0.7)' : '#10B981' }}
                  >
                    {pending.length > 0
                      ? `${pending.length} tâche${pending.length > 1 ? 's' : ''} à faire`
                      : 'Tout est fait'}
                  </Text>
                </View>
              </View>
            </View>

            {pending.length > 0 && (
              <View className="gap-3">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">À faire</Text>
                {pending.map((t) => {
                  const assignee = employeeName(t.assigneeId);
                  return (
                    <Pressable
                      key={t.id}
                      onPress={() => openSign(t)}
                      className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4 active:bg-gray-50"
                    >
                      <View className="w-10 h-10 rounded-xl border-2 border-gray-200" />
                      <View className="flex-1">
                        <Text className="text-sm font-black text-gray-900 uppercase">{t.label}</Text>
                        {!!t.description && (
                          <Text className="text-[11px] font-medium text-gray-500 mt-0.5">{t.description}</Text>
                        )}
                        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                          {frequencyLabel(t)}{assignee ? ` • ${assignee}` : ''}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {done.length > 0 && (
              <View className="gap-3">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Faites</Text>
                {done.map((t) => {
                  const c = doneOf(t)!;
                  return (
                    <View key={t.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4">
                      <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                        <Check size={18} color="#10B981" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-black text-gray-400 uppercase line-through">{t.label}</Text>
                        <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
                          {c.operatorName} • {format(new Date(c.timestamp), 'HH:mm')}
                        </Text>
                        {!!c.notes && (
                          <Text className="text-[11px] font-medium text-gray-500 mt-0.5">{c.notes}</Text>
                        )}
                      </View>
                      <Pressable
                        onPress={() => uncompleteTask(t.id, today)}
                        className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                      >
                        <RotateCcw size={14} color="#9CA3AF" />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!signing} transparent animationType="fade" onRequestClose={() => setSigning(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 gap-5">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{signing?.label}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Qui a fait cette tâche ?</Text>
              </View>
              <Pressable onPress={() => setSigning(null)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                <X size={16} color="#9CA3AF" />
              </Pressable>
            </View>

            {employees.length === 0 ? (
              <View className="bg-alert/10 border border-alert/30 rounded-2xl p-4 gap-3">
                <Text className="text-[11px] font-medium text-gray-600">
                  Aucun membre d'équipe enregistré. Ajoutez-en dans Paramètres → Personnalisation → Équipe
                  pour pouvoir signer une tâche.
                </Text>
                <Pressable
                  onPress={() => { setSigning(null); router.push('/(tabs)/settings' as any); }}
                  className="py-3 bg-primary rounded-xl"
                >
                  <Text className="text-[10px] font-black text-white uppercase text-center">Ouvrir les paramètres</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View className="flex-row flex-wrap gap-2">
                  {employees.map((e) => (
                    <Pressable
                      key={e.id}
                      onPress={() => setPickedId(e.id)}
                      className={cn('px-4 py-3 rounded-xl border', pickedId === e.id ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}
                    >
                      <Text className={cn('text-[11px] font-black uppercase', pickedId === e.id ? 'text-primary' : 'text-gray-600')}>
                        {e.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Remarque (optionnel)"
                  className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                />

                <Pressable
                  onPress={confirmSign}
                  disabled={!pickedId}
                  className={cn('py-4 bg-primary rounded-2xl flex-row items-center justify-center gap-2', !pickedId && 'opacity-40')}
                >
                  <Check size={16} color="#fff" />
                  <Text className="text-[11px] font-black text-white uppercase">Marquer comme faite</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
