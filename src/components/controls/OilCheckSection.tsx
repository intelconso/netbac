import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { AlertCircle, CheckCircle2, Droplets, Pencil, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn, formatDate } from '../../lib/utils';
import { lastControllerName } from '../../lib/controller';
import { isClosedDay } from '../../lib/serviceDays';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Contrôle quotidien des huiles de friture — one global daily check mirroring
// the paper register page. Conforme / non conforme + "huile changée"
// (récupération par organisme agréé) + optional note.
// `embedded`: rendered inside a card that already shows the title and the
// done/to-do status, so the header row and status banners are skipped.
export default function OilCheckSection({ embedded = false }: { embedded?: boolean }) {
  const store = useActiveStore();
  const { oilChecks, addOilCheck, updateOilCheck, closedWeekdays, singleServiceWeekdays, dayOverrides } = store;
  // Seuls les jours fermés sont neutralisés ici (le service unique attend le
  // contrôle des huiles comme un jour ouvert).
  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };
  const [isAdding, setIsAdding] = useState(false);
  const [controller, setController] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  // Start-of-day timestamp of the missed day being backfilled, null otherwise.
  const [backfillDay, setBackfillDay] = useState<number | null>(null);
  const [result, setResult] = useState<'conforme' | 'non_conforme'>('conforme');
  const [oilChanged, setOilChanged] = useState(false);
  const [notes, setNotes] = useState('');

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const checkedToday = oilChecks.some((c) => c.timestamp >= startOfToday);
  // Only today's entries — previous days live in the controls-history screen.
  const recent = oilChecks
    .filter((c) => c.timestamp >= startOfToday)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Days of the past week with no check, starting from the first-ever check
  // (no point flagging days before the feature was used).
  const DAY = 86400000;
  const firstCheckAt = oilChecks.reduce((min, c) => Math.min(min, c.timestamp), Infinity);
  const missedDays: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = startOfToday - i * DAY;
    if (day + DAY <= firstCheckAt) break;
    if (isClosedDay(day, schedule)) continue; // service fermé — pas un manque
    const covered = oilChecks.some((c) => c.timestamp >= day && c.timestamp < day + DAY);
    if (!covered) missedDays.push(day);
  }

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setBackfillDay(null);
    setResult('conforme');
    setOilChanged(false);
    setNotes('');
  };

  const handleSave = () => {
    if (!controller.trim()) return;
    const data = {
      result,
      oilChanged,
      operatorName: controller.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };
    if (editingId) {
      updateOilCheck(editingId, data);
    } else {
      addOilCheck(
        {
          ...data,
          ...(backfillDay ? { backfilled: true } : {}),
        },
        // Noon keeps the backfilled check safely inside its day across DST.
        backfillDay ? { timestamp: backfillDay + 12 * 3600000 } : undefined
      );
    }
    closeForm();
  };

  const startEdit = (id: string) => {
    const check = oilChecks.find((c) => c.id === id);
    if (!check) return;
    setEditingId(id);
    setResult(check.result);
    setOilChanged(check.oilChanged);
    setNotes(check.notes ?? '');
    setController(check.operatorName ?? lastControllerName(store));
    setIsAdding(true);
  };

  const openForm = () => {
    setController(lastControllerName(store));
    setIsAdding(true);
  };

  return (
    <View className="gap-4">
      {!embedded && (
        <View className="flex-row justify-between items-center">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Huiles de friture</Text>
        </View>
      )}

      {!embedded && checkedToday && (
        <View className="bg-success/10 p-4 rounded-2xl flex-row items-center gap-3">
          <CheckCircle2 size={18} color="#10B981" />
          <Text className="text-[10px] font-black text-success uppercase tracking-widest">Contrôle du jour effectué</Text>
        </View>
      )}
      {!embedded && !checkedToday && !isAdding && (
        <View className="bg-alert/10 p-4 rounded-2xl flex-row items-center gap-3">
          <AlertCircle size={18} color="#F59E0B" />
          <Text className="text-[10px] font-black text-alert uppercase tracking-widest">Contrôle du jour à faire</Text>
        </View>
      )}

      {!checkedToday && !isAdding && (
        <Pressable onPress={openForm} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
          <Droplets size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Contrôler maintenant</Text>
        </Pressable>
      )}

      {!isAdding && missedDays.length > 0 && (
        <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {missedDays.length} jour{missedDays.length > 1 ? 's' : ''} sans contrôle — compléter
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {missedDays.map((day) => (
              <Pressable
                key={day}
                onPress={() => { setBackfillDay(day); setIsAdding(true); }}
                className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100"
              >
                <Text className="text-[10px] font-black text-gray-600 uppercase">
                  {format(new Date(day), 'EEE d MMM', { locale: fr })}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          {backfillDay && (
            <View className="bg-alert/10 p-3 rounded-xl">
              <Text className="text-[10px] font-black text-alert uppercase tracking-widest text-center">
                Saisie a posteriori — {format(new Date(backfillDay), 'EEEE d MMMM', { locale: fr })}
              </Text>
            </View>
          )}
          <View className="flex-row gap-2">
            <Pressable onPress={() => setResult('conforme')} className={cn('flex-1 py-3 rounded-xl border items-center', result === 'conforme' ? 'bg-success/10 border-success' : 'bg-gray-50 border-gray-100')}>
              <Text className={cn('text-[10px] font-black uppercase', result === 'conforme' ? 'text-success' : 'text-gray-400')}>Conforme</Text>
            </Pressable>
            <Pressable onPress={() => setResult('non_conforme')} className={cn('flex-1 py-3 rounded-xl border items-center', result === 'non_conforme' ? 'bg-danger/10 border-danger' : 'bg-gray-50 border-gray-100')}>
              <Text className={cn('text-[10px] font-black uppercase', result === 'non_conforme' ? 'text-danger' : 'text-gray-400')}>Non conforme</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => setOilChanged((v) => !v)} className="flex-row items-center gap-3">
            <View className={cn('w-5 h-5 rounded-md border items-center justify-center', oilChanged ? 'bg-primary border-primary' : 'border-gray-300')}>
              {oilChanged && <CheckCircle2 size={14} color="#fff" />}
            </View>
            <Text className="text-[10px] font-bold text-gray-600 uppercase">Huile changée (récupération par organisme agréé)</Text>
          </Pressable>
          <TextInput
            placeholder="Notes (optionnel)" value={notes} onChangeText={setNotes}
            className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
          />
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Contrôleur</Text>
            <TextInput
              placeholder="Nom du contrôleur" value={controller} onChangeText={setController}
              className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
            />
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={closeForm} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
            <Pressable disabled={!controller.trim()} onPress={handleSave} className={cn('flex-1 py-3 bg-primary rounded-xl', !controller.trim() && 'opacity-40')}><Text className="text-[10px] font-black uppercase text-center text-white">{editingId ? 'Modifier' : 'Enregistrer'}</Text></Pressable>
          </View>
        </View>
      )}

      <View className="gap-3">
        {recent.map((check) => (
          <View key={check.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className={cn('w-10 h-10 rounded-xl items-center justify-center', check.result === 'conforme' ? 'bg-success/10' : 'bg-danger/10')}>
                {check.result === 'conforme'
                  ? <CheckCircle2 size={18} color="#10B981" />
                  : <XCircle size={18} color="#EF4444" />}
              </View>
              <View>
                <Text className="text-xs font-black text-gray-900 uppercase">
                  {check.result === 'conforme' ? 'Conforme' : 'Non conforme'}
                  {check.oilChanged ? ' • Huile changée' : ''}
                </Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase">
                  {formatDate(check.timestamp)}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => startEdit(check.id)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
              <Pencil size={14} color="#9CA3AF" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
