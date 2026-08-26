import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { format } from 'date-fns';
import { Check, CheckCircle2, ListChecks, Pencil, PartyPopper, RotateCcw } from 'lucide-react-native';
import { useActiveStore } from '../lib/useActive';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import {
  completionFor, firstPendingIndex, frequencyLabel, lastTaskEmployeeId,
  photosForCompletion, queueForEmployee, SERVICE_LABELS, TaskInstance,
} from '../lib/tasks';
import { useTaskPhotoDrafts } from '../lib/useTaskPhotoDrafts';
import TaskPhotoPicker from './TaskPhotoPicker';
import TaskPhotoStrip from './TaskPhotoStrip';

// Pas-à-pas des tâches — une tâche à l'écran, comme la saisie des températures.
//
// Le pas-à-pas retourne la question de la vue liste. La liste demande « qui a
// fait ça ? » à CHAQUE cochage ; ici on demande « qui êtes-vous ? » UNE FOIS,
// puis on déroule la tournée de cette personne. C'est tout l'intérêt : sur dix
// tâches, dix sélections de nom deviennent une seule.
//
// D'où découle le regroupement : la file est celle de l'employé choisi — ses
// tâches attribuées d'abord, puis celles qui n'attendent personne en
// particulier (voir queueForEmployee). Guidé mais jamais verrouillé : on peut
// revenir, sauter, ou repasser par la vue liste pour cocher n'importe quoi.
interface TaskStepperProps {
  day: number;
  due: TaskInstance[];
  showServiceTag: boolean;
}

export default function TaskStepper({ day, due, showServiceTag }: TaskStepperProps) {
  const { taskCompletions, taskPhotos, employees } = useActiveStore();
  const completeTask = useStore((s) => s.completeTask);
  const uncompleteTask = useStore((s) => s.uncompleteTask);
  const photos = useTaskPhotoDrafts();

  // « Qui êtes-vous ? » — demandé une fois, comme le champ Contrôleur des
  // relevés de température. Pré-rempli avec la dernière personne à avoir coché.
  const [pickedId, setPickedId] = useState<string | undefined>(() => {
    const last = lastTaskEmployeeId(taskCompletions);
    return last && employees.some((e) => e.id === last) ? last : employees[0]?.id;
  });
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [note, setNote] = useState('');
  // Une tâche déjà cochée s'affiche en récapitulatif ; « Modifier » rouvre la
  // saisie pour compléter une remarque ou une photo sans avoir à décocher.
  const [editing, setEditing] = useState(false);

  const employee = employees.find((e) => e.id === pickedId);
  const queue = useMemo(() => queueForEmployee(due, pickedId), [due, pickedId]);
  const doneOf = (i: TaskInstance) => completionFor(i.task.id, day, taskCompletions, i.service);

  // Reprise au premier passage non coché, recalculée tant qu'on n'a pas
  // navigué soi-même (stepIndex null = « pas encore décidé »).
  const resumeAt = firstPendingIndex(queue, day, taskCompletions);
  const safeIndex = Math.min(stepIndex ?? resumeAt, Math.max(queue.length - 1, 0));
  const current: TaskInstance | undefined = queue[safeIndex];
  const remaining = queue.filter((i) => !doneOf(i)).length;

  const goTo = (i: number) => {
    photos.discardAll();
    setNote('');
    setEditing(false);
    setStepIndex(Math.max(0, Math.min(i, queue.length - 1)));
  };

  const saveAndAdvance = () => {
    if (!current || !employee) return;
    const { task, service } = current;
    completeTask(
      task.id,
      { employeeId: employee.id, operatorName: employee.name, notes: note },
      { dayKey: day, service }
    );
    photos.commit({
      taskId: task.id,
      dayKey: day,
      service,
      employeeId: employee.id,
      operatorName: employee.name,
    });
    setNote('');
    setEditing(false);
    // Enchaîne sur la suivante — sans déborder de la file.
    setStepIndex(Math.min(safeIndex + 1, queue.length - 1));
  };

  // Ajout de photos sur une tâche déjà cochée : on n'enregistre pas un
  // deuxième cochage, on attache seulement la preuve.
  const attachOnly = () => {
    if (!current || !employee) return;
    photos.commit({
      taskId: current.task.id,
      dayKey: day,
      service: current.service,
      employeeId: employee.id,
      operatorName: employee.name,
    });
    setEditing(false);
  };

  if (employees.length === 0) {
    return (
      <View className="bg-alert/10 border border-alert/30 rounded-2xl p-4">
        <Text className="text-[11px] font-medium text-gray-600">
          Aucun membre d'équipe enregistré. Ajoutez-en dans Paramètres → Personnalisation → Équipe
          pour pouvoir signer une tâche.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="gap-2">
        <Text className="text-[9px] font-bold text-gray-400 uppercase">Qui êtes-vous ?</Text>
        <View className="flex-row flex-wrap gap-2">
          {employees.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => {
                // Changer de personne change la file : on repart de sa reprise
                // naturelle (stepIndex null) plutôt que de garder un index qui
                // ne désigne plus la même tâche.
                photos.discardAll();
                setNote('');
                setEditing(false);
                setPickedId(e.id);
                setStepIndex(null);
              }}
              className={cn('px-4 py-3 rounded-xl border', pickedId === e.id ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
            >
              <Text className={cn('text-[11px] font-black uppercase', pickedId === e.id ? 'text-primary' : 'text-gray-600')}>
                {e.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {queue.length === 0 ? (
        <View className="bg-white p-8 rounded-3xl border border-dashed border-gray-200 items-center gap-3">
          <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center">
            <ListChecks size={26} color="#D1D5DB" />
          </View>
          <Text className="text-sm font-black text-gray-900 uppercase text-center">Rien dans votre tournée</Text>
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
            Les tâches attribuées à quelqu'un d'autre restent dans la vue liste
          </Text>
        </View>
      ) : (
        <>
          {/* Fil des tâches — un point par passage, vert = fait, cliquable pour sauter */}
          <View className="flex-row items-center justify-center flex-wrap gap-2">
            {queue.map((i, idx) => {
              const isDone = !!doneOf(i);
              const isCur = idx === safeIndex;
              return (
                <Pressable
                  key={i.key}
                  onPress={() => goTo(idx)}
                  hitSlop={6}
                  className={cn(
                    'rounded-full',
                    isCur ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5',
                    isDone ? 'bg-success' : isCur ? 'bg-primary' : 'bg-gray-200',
                    isCur && !isDone && 'border-2 border-primary',
                  )}
                />
              );
            })}
          </View>
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center -mt-1">
            Tâche {safeIndex + 1} / {queue.length}
            {remaining === 0 ? ' • tout est fait' : ` • ${remaining} restante${remaining > 1 ? 's' : ''}`}
          </Text>

          {current && (() => {
            const existing = doneOf(current);
            const attached = photosForCompletion(current.task.id, day, taskPhotos, current.service);
            const meta = showServiceTag && current.service
              ? SERVICE_LABELS[current.service]
              : frequencyLabel(current.task);

            if (existing && !editing) {
              return (
                <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
                  <View className="flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-success/10 items-center justify-center">
                      <CheckCircle2 size={18} color="#10B981" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-xs font-black text-gray-900 uppercase">{current.task.label}</Text>
                      <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                        {existing.operatorName} • {format(new Date(existing.timestamp), 'HH:mm')}
                        {existing.notes ? ` • ${existing.notes}` : ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => setEditing(true)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                      <Pencil size={14} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      onPress={() => uncompleteTask(current.task.id, day, current.service)}
                      className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                    >
                      <RotateCcw size={14} color="#9CA3AF" />
                    </Pressable>
                  </View>
                  <TaskPhotoStrip photos={attached} />
                </View>
              );
            }

            return (
              <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-4">
                <View>
                  <Text className="text-base font-black text-gray-900 uppercase">{current.task.label}</Text>
                  {!!current.task.description && (
                    <Text className="text-[11px] font-medium text-gray-500 mt-1">{current.task.description}</Text>
                  )}
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-1">{meta}</Text>
                </View>

                {!existing && (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder="Remarque (optionnel)"
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                )}

                <TaskPhotoPicker
                  existing={attached}
                  drafts={photos.drafts}
                  busy={photos.busy}
                  error={photos.error}
                  onAdd={photos.addPhoto}
                  onDrop={photos.dropDraft}
                />

                <Pressable
                  onPress={existing ? attachOnly : saveAndAdvance}
                  disabled={!employee || (!!existing && photos.drafts.length === 0)}
                  className={cn(
                    'py-4 bg-primary rounded-2xl flex-row items-center justify-center gap-2',
                    (!employee || (!!existing && photos.drafts.length === 0)) && 'opacity-40'
                  )}
                >
                  <Check size={16} color="#fff" />
                  <Text className="text-[11px] font-black text-white uppercase">
                    {existing ? 'Ajouter la preuve' : 'Fait — suivante'}
                  </Text>
                </Pressable>
              </View>
            );
          })()}

          {/* Navigation pas-à-pas — guidé mais libre (revenir / sauter) */}
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => goTo(safeIndex - 1)}
              disabled={safeIndex === 0}
              className={cn('flex-1 py-3 rounded-xl items-center border border-gray-100 bg-gray-50', safeIndex === 0 && 'opacity-30')}
            >
              <Text className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Précédent</Text>
            </Pressable>
            <Pressable
              onPress={() => goTo(safeIndex + 1)}
              disabled={safeIndex >= queue.length - 1}
              className={cn('flex-1 py-3 rounded-xl items-center border border-gray-100 bg-gray-50', safeIndex >= queue.length - 1 && 'opacity-30')}
            >
              <Text className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Passer</Text>
            </Pressable>
          </View>

          {remaining === 0 && (
            <View className="bg-primary/10 border border-primary/30 p-5 rounded-2xl items-center gap-2">
              <PartyPopper size={22} color="#10B981" />
              <Text className="text-xs font-black text-primary uppercase tracking-widest text-center">
                Tournée terminée
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}
