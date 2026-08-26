import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Camera, CalendarOff, Check, History, ListChecks, RotateCcw, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useActiveStore } from '../src/lib/useActive';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import { dayStatus, startOfDayMs } from '../src/lib/serviceDays';
import {
  completionFor, dueTasksFor, frequencyLabel, lastTaskEmployeeId, photosForCompletion,
  servicesFor, SERVICE_LABELS, SERVICE_SHORT, TaskInstance,
} from '../src/lib/tasks';
import { useTaskPhotoDrafts } from '../src/lib/useTaskPhotoDrafts';
import TaskPhotoStrip from '../src/components/TaskPhotoStrip';
import TaskPhotoPicker from '../src/components/TaskPhotoPicker';
import TaskStepper from '../src/components/TaskStepper';

// Checklist d'équipe — le travail quotidien non réglementaire, par opposition
// aux contrôles HACCP de l'écran Traçabilité. L'admin définit les tâches et
// leur récurrence dans Paramètres ; ici l'équipe les coche au fil du service.
//
// L'unité affichée n'est pas la tâche mais le PASSAGE (TaskInstance) : une tâche
// « chaque service » apparaît deux fois un jour ouvert (début et fin), une seule
// fois un jour à service unique. C'est dueTasksFor() qui tranche, d'après le
// planning — l'écran ne fait que dérouler ce qu'on lui rend.
//
// Deux vues sur la même journée, parce que deux usages :
//   - Liste     : tout d'un coup d'œil, pour cocher UNE chose au passage. Le nom
//                 est demandé à chaque cochage, dans une feuille.
//   - Pas à pas : la tournée d'une personne, une tâche à l'écran, comme la saisie
//                 des températures. Le nom est demandé une seule fois.
// La liste reste le défaut : ouvrir l'écran pour cocher une case ne doit pas
// imposer de traverser un assistant.
//
// Chaque cochage enregistre qui l'a fait : l'app étant mono-compte (un login
// par restaurant), le nom vient de la liste Équipe, pas de l'authentification.
//
// Le cochage peut porter des photos — le témoignage que la tâche a été faite,
// et bien faite. Toujours facultatives : rien ne bloque jamais un cochage, une
// équipe en plein service ne doit pas rester coincée devant un bouton grisé.
// Elles restent en revanche définitivement (voir TaskPhoto), et se relisent
// dans l'historique des contrôles.
export default function TasksScreen() {
  const router = useRouter();
  const {
    tasks, taskCompletions, taskPhotos, employees,
    closedWeekdays, singleServiceWeekdays, dayOverrides,
  } = useActiveStore();
  const completeTask = useStore((s) => s.completeTask);
  const uncompleteTask = useStore((s) => s.uncompleteTask);
  const photos = useTaskPhotoDrafts();

  const today = startOfDayMs(Date.now());
  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };
  const closedToday = dayStatus(today, schedule) === 'closed';
  // Un jour à service unique n'a qu'un passage : afficher « Début » y serait
  // faux — il n'y a pas de « fin » en face. La pastille ne sort qu'à deux services.
  const showServiceTag = servicesFor(today, schedule).length > 1;

  const [view, setView] = useState<'liste' | 'pas'>('liste');

  const due = useMemo(
    () => dueTasksFor(today, tasks, taskCompletions, schedule),
    [today, tasks, taskCompletions, closedWeekdays, singleServiceWeekdays, dayOverrides]
  );
  const doneOf = (i: TaskInstance) => completionFor(i.task.id, today, taskCompletions, i.service);
  const pending = due.filter((i) => !doneOf(i));
  const done = due.filter((i) => doneOf(i));

  // Feuille de cochage de la vue liste : on demande qui fait la tâche avant
  // d'enregistrer. Deux usages, même feuille — `complete` coche le passage,
  // `photos` ne fait qu'ajouter une preuve à un cochage déjà enregistré.
  const [signing, setSigning] = useState<{ instance: TaskInstance; mode: 'complete' | 'photos' } | null>(null);
  const [pickedId, setPickedId] = useState<string | undefined>(undefined);
  const [note, setNote] = useState('');

  const openSign = (instance: TaskInstance) => {
    // Pré-sélection : la personne visée par la tâche, sinon la dernière à avoir
    // coché quoi que ce soit — pour que le geste courant reste un seul tap.
    const last = lastTaskEmployeeId(taskCompletions);
    const assignee = instance.task.assigneeId;
    const suggested = assignee && employees.some((e) => e.id === assignee)
      ? assignee
      : (last && employees.some((e) => e.id === last) ? last : employees[0]?.id);
    setSigning({ instance, mode: 'complete' });
    setPickedId(suggested);
    setNote('');
    photos.discardAll();
  };

  // Compléter une preuve après coup. Le nom proposé est celui qui a coché, mais
  // reste modifiable : la photo de rattrapage peut être prise par un autre.
  const openAddPhotos = (instance: TaskInstance) => {
    const c = doneOf(instance);
    setSigning({ instance, mode: 'photos' });
    setPickedId(c?.employeeId ?? employees[0]?.id);
    setNote('');
    photos.discardAll();
  };

  // Fermer sans valider jette les fichiers pris dans la feuille : ils n'ont
  // jamais été attachés à quoi que ce soit.
  const closeSheet = () => {
    photos.discardAll();
    setSigning(null);
  };

  const confirmSign = () => {
    if (!signing || !pickedId) return;
    const employee = employees.find((e) => e.id === pickedId);
    if (!employee) return;
    const { task, service } = signing.instance;
    if (signing.mode === 'complete') {
      completeTask(
        task.id,
        { employeeId: employee.id, operatorName: employee.name, notes: note },
        { dayKey: today, service }
      );
    }
    photos.commit({
      taskId: task.id,
      dayKey: today,
      service,
      employeeId: employee.id,
      operatorName: employee.name,
    });
    setSigning(null);
  };

  const employeeName = (id?: string) => employees.find((e) => e.id === id)?.name;
  // En mode « photos », valider sans photo ne ferait rien.
  const canConfirm = !!pickedId && (signing?.mode === 'complete' || photos.drafts.length > 0);

  // Pastille « Début » / « Fin » sur un passage de tâche « chaque service ».
  const ServiceTag = ({ instance }: { instance: TaskInstance }) =>
    showServiceTag && instance.service ? (
      <View className="px-2 py-1 rounded-lg bg-gray-100">
        <Text className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
          {SERVICE_SHORT[instance.service]}
        </Text>
      </View>
    ) : null;

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

            {/* Deux façons de cocher la même journée — voir l'en-tête du fichier. */}
            <View className="flex-row p-1 bg-gray-100 rounded-2xl">
              {([['liste', 'Liste'], ['pas', 'Pas à pas']] as const).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => { closeSheet(); setView(id); }}
                  className={cn('flex-1 py-2.5 rounded-xl items-center', view === id && 'bg-white')}
                >
                  <Text className={cn('text-[9px] font-black uppercase tracking-widest', view === id ? 'text-primary' : 'text-gray-400')}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {view === 'pas' ? (
              <TaskStepper day={today} due={due} showServiceTag={showServiceTag} />
            ) : (
              <>
                {pending.length > 0 && (
                  <View className="gap-3">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">À faire</Text>
                    {pending.map((i) => {
                      const assignee = employeeName(i.task.assigneeId);
                      return (
                        <Pressable
                          key={i.key}
                          onPress={() => openSign(i)}
                          className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4 active:bg-gray-50"
                        >
                          <View className="w-10 h-10 rounded-xl border-2 border-gray-200" />
                          <View className="flex-1">
                            <Text className="text-sm font-black text-gray-900 uppercase">{i.task.label}</Text>
                            {!!i.task.description && (
                              <Text className="text-[11px] font-medium text-gray-500 mt-0.5">{i.task.description}</Text>
                            )}
                            <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                              {showServiceTag && i.service ? SERVICE_LABELS[i.service] : frequencyLabel(i.task)}
                              {assignee ? ` • ${assignee}` : ''}
                            </Text>
                          </View>
                          <ServiceTag instance={i} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}

                {done.length > 0 && (
                  <View className="gap-3">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Faites</Text>
                    {done.map((i) => {
                      const c = doneOf(i)!;
                      const attached = photosForCompletion(i.task.id, today, taskPhotos, i.service);
                      return (
                        <View key={i.key} className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
                          <View className="flex-row items-center gap-4">
                            <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                              <Check size={18} color="#10B981" />
                            </View>
                            <View className="flex-1">
                              <Text className="text-sm font-black text-gray-400 uppercase line-through">{i.task.label}</Text>
                              <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
                                {c.operatorName} • {format(new Date(c.timestamp), 'HH:mm')}
                              </Text>
                              {!!c.notes && (
                                <Text className="text-[11px] font-medium text-gray-500 mt-0.5">{c.notes}</Text>
                              )}
                            </View>
                            <ServiceTag instance={i} />
                            <Pressable
                              onPress={() => openAddPhotos(i)}
                              className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                            >
                              <Camera size={14} color="#9CA3AF" />
                            </Pressable>
                            <Pressable
                              onPress={() => uncompleteTask(i.task.id, today, i.service)}
                              className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                            >
                              <RotateCcw size={14} color="#9CA3AF" />
                            </Pressable>
                          </View>
                          <TaskPhotoStrip photos={attached} />
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!signing} transparent animationType="fade" onRequestClose={closeSheet}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-3xl p-6 gap-5">
            <View className="flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{signing?.instance.task.label}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  {showServiceTag && signing?.instance.service
                    ? `${SERVICE_LABELS[signing.instance.service]} • `
                    : ''}
                  {signing?.mode === 'photos' ? 'Ajouter une photo' : 'Qui a fait cette tâche ?'}
                </Text>
              </View>
              <Pressable onPress={closeSheet} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
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
                  onPress={() => { closeSheet(); router.push('/(tabs)/settings' as any); }}
                  className="py-3 bg-primary rounded-xl"
                >
                  <Text className="text-[10px] font-black text-white uppercase text-center">Ouvrir les paramètres</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView className="max-h-[70%]" contentContainerStyle={{ gap: 20 }} keyboardShouldPersistTaps="handled">
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

                {signing?.mode === 'complete' && (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Remarque (optionnel)"
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                )}

                <TaskPhotoPicker
                  existing={signing ? photosForCompletion(
                    signing.instance.task.id, today, taskPhotos, signing.instance.service
                  ) : []}
                  drafts={photos.drafts}
                  busy={photos.busy}
                  error={photos.error}
                  onAdd={photos.addPhoto}
                  onDrop={photos.dropDraft}
                />

                <Pressable
                  onPress={confirmSign}
                  disabled={!canConfirm}
                  className={cn('py-4 bg-primary rounded-2xl flex-row items-center justify-center gap-2', !canConfirm && 'opacity-40')}
                >
                  <Check size={16} color="#fff" />
                  <Text className="text-[11px] font-black text-white uppercase">
                    {signing?.mode === 'photos'
                      ? (photos.drafts.length > 1 ? `Ajouter ${photos.drafts.length} photos` : 'Ajouter la photo')
                      : 'Marquer comme faite'}
                  </Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
