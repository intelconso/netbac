import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { CheckCircle2, Pencil, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;

// Contrôles nettoyage — un contrôle par zone et par jour. "Conforme"
// s'enregistre en un geste ; "Non conforme" exige l'action corrective
// (colonne "Actions correctives si besoin" du registre papier).
export default function CleaningCheckSection() {
  const { cleaningAreas, cleaningChecks, addCleaningCheck, updateCleaningCheck } = useActiveStore();

  const [backfillDay, setBackfillDay] = useState<number | null>(null);
  // Zone whose "non conforme" corrective-action input is open, and its draft.
  const [ncArea, setNcArea] = useState<string | null>(null);
  const [ncDraft, setNcDraft] = useState('');
  const [editingArea, setEditingArea] = useState<string | null>(null);

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const dayStart = backfillDay ?? startOfToday;
  const dayEnd = dayStart + DAY;

  const checkFor = (area: string) =>
    cleaningChecks.find((c) => c.area === area && c.timestamp >= dayStart && c.timestamp < dayEnd);

  const firstCheckAt = cleaningChecks.reduce((min, c) => Math.min(min, c.timestamp), Infinity);
  const missedDays: number[] = [];
  for (let i = 1; i <= 7; i++) {
    const day = startOfToday - i * DAY;
    if (day + DAY <= firstCheckAt) break;
    const covered = cleaningChecks.some((c) => c.timestamp >= day && c.timestamp < day + DAY);
    if (!covered) missedDays.push(day);
  }

  const closeInputs = () => {
    setNcArea(null);
    setNcDraft('');
    setEditingArea(null);
  };

  const save = (area: string, result: 'conforme' | 'non_conforme', correctiveAction?: string) => {
    const data = { result, ...(correctiveAction ? { correctiveAction } : {}) };
    const existing = checkFor(area);
    if (existing) {
      updateCleaningCheck(existing.id, { ...data, ...(correctiveAction ? {} : { correctiveAction: undefined }) });
    } else {
      addCleaningCheck(
        { ...data, area, ...(backfillDay ? { backfilled: true } : {}) },
        backfillDay ? { timestamp: backfillDay + 15 * 3600000 } : undefined
      );
    }
    closeInputs();
  };

  return (
    <View className="gap-4">
      {backfillDay && (
        <View className="bg-alert/10 p-3 rounded-xl flex-row items-center justify-between">
          <Text className="text-[10px] font-black text-alert uppercase tracking-widest flex-1">
            Saisie a posteriori — {format(new Date(backfillDay), 'EEEE d MMMM', { locale: fr })}
          </Text>
          <Pressable onPress={() => { setBackfillDay(null); closeInputs(); }}>
            <Text className="text-[10px] font-black text-gray-400 uppercase">Retour</Text>
          </Pressable>
        </View>
      )}

      <View className="gap-3">
        {cleaningAreas.map((area) => {
          const existing = checkFor(area);
          const editing = editingArea === area;
          const ncOpen = ncArea === area;

          if (existing && !editing) {
            return (
              <View key={area} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3 flex-1">
                  <View className={cn('w-10 h-10 rounded-xl items-center justify-center', existing.result === 'conforme' ? 'bg-success/10' : 'bg-danger/10')}>
                    {existing.result === 'conforme'
                      ? <CheckCircle2 size={18} color="#10B981" />
                      : <XCircle size={18} color="#EF4444" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-gray-900 uppercase">{area}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5" numberOfLines={1}>
                      {format(new Date(existing.timestamp), 'HH:mm', { locale: fr })}
                      {existing.correctiveAction ? ` • ${existing.correctiveAction}` : ''}
                    </Text>
                  </View>
                </View>
                <Pressable onPress={() => { setEditingArea(area); setNcArea(null); setNcDraft(existing.correctiveAction ?? ''); }} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                  <Pencil size={14} color="#9CA3AF" />
                </Pressable>
              </View>
            );
          }

          return (
            <View key={area} className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
              <Text className="text-xs font-black text-gray-900 uppercase">{area}</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={() => save(area, 'conforme')} className="flex-1 py-3 rounded-xl border bg-success/10 border-success items-center">
                  <Text className="text-[10px] font-black uppercase text-success">Conforme</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setNcArea(ncOpen ? null : area); if (!editing) setNcDraft(''); }}
                  className={cn('flex-1 py-3 rounded-xl border items-center', ncOpen ? 'bg-danger/10 border-danger' : 'bg-gray-50 border-gray-100')}
                >
                  <Text className={cn('text-[10px] font-black uppercase', ncOpen ? 'text-danger' : 'text-gray-400')}>Non conforme</Text>
                </Pressable>
              </View>
              {ncOpen && (
                <View className="gap-2">
                  <Text className="text-[9px] font-black text-danger uppercase tracking-widest">Action corrective requise</Text>
                  <TextInput
                    value={ncDraft}
                    onChangeText={setNcDraft}
                    placeholder="Ex. zone renettoyée, produit changé..."
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                  <Pressable
                    disabled={!ncDraft.trim()}
                    onPress={() => save(area, 'non_conforme', ncDraft.trim())}
                    className={cn('py-3 bg-danger rounded-xl items-center', !ncDraft.trim() && 'opacity-40')}
                  >
                    <Text className="text-[10px] font-black text-white uppercase">Enregistrer non conforme</Text>
                  </Pressable>
                </View>
              )}
              {editing && (
                <Pressable onPress={closeInputs} className="py-2">
                  <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {!backfillDay && missedDays.length > 0 && (
        <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
            {missedDays.length} jour{missedDays.length > 1 ? 's' : ''} sans contrôle — compléter
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {missedDays.map((day) => (
              <Pressable
                key={day}
                onPress={() => { setBackfillDay(day); closeInputs(); }}
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
    </View>
  );
}
