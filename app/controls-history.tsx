import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Droplets, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../src/lib/useActive';
import { cn } from '../src/lib/utils';
import { addMonths, endOfMonth, format, startOfDay, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

// Historique des contrôles HACCP, groupé par jour (le plus récent en premier),
// un mois affiché à la fois. Chaque type de contrôle du registre alimente la
// même liste : pour l'instant les huiles de friture, les prochains contrôles
// s'ajoutent en mappant leurs enregistrements vers `DayEntry`.
interface DayEntry {
  id: string;
  control: string;
  icon: typeof Droplets;
  ok: boolean;
  title: string;
  subtitle: string;
  timestamp: number;
  // Optional pill shown on the card (e.g. "huile changée").
  badge?: string;
  // Rows shown in the detail modal when the card is tapped.
  details: { label: string; value: string }[];
}

export default function ControlsHistoryScreen() {
  const router = useRouter();
  const { oilChecks } = useActiveStore();
  const [selected, setSelected] = useState<DayEntry | null>(null);

  // One month displayed at a time — the paper register is kept monthly, and
  // it bounds rendering as the history grows over years.
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const monthStart = month.getTime();
  const monthEnd = endOfMonth(month).getTime();

  const earliest = useMemo(
    () => oilChecks.reduce((min, c) => Math.min(min, c.timestamp), Date.now()),
    [oilChecks]
  );
  const canGoBack = monthStart > startOfMonth(new Date(earliest)).getTime();
  const canGoForward = monthStart < startOfMonth(new Date()).getTime();

  const days = useMemo(() => {
    const entries: DayEntry[] = oilChecks
      .filter((c) => c.timestamp >= monthStart && c.timestamp <= monthEnd)
      .map((c) => ({
        id: c.id,
        control: 'Huiles de friture',
        icon: Droplets,
        ok: c.result === 'conforme',
        title: c.result === 'conforme' ? 'Conforme' : 'Non conforme',
        subtitle: `${format(new Date(c.timestamp), 'HH:mm', { locale: fr })} • ${c.operatorName}`,
        timestamp: c.timestamp,
        ...(c.oilChanged ? { badge: 'Huile changée' } : {}),
        details: [
          { label: 'Résultat', value: c.result === 'conforme' ? 'Conforme' : 'Non conforme' },
          { label: 'Huile changée', value: c.oilChanged ? 'Oui — récupération par organisme agréé' : 'Non' },
          { label: 'Contrôleur', value: c.operatorName },
          { label: 'Date', value: format(new Date(c.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
          ...(c.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
          ...(c.notes ? [{ label: 'Notes', value: c.notes }] : []),
        ],
      }));

    const byDay = new Map<number, DayEntry[]>();
    for (const e of entries) {
      const day = startOfDay(new Date(e.timestamp)).getTime();
      byDay.set(day, [...(byDay.get(day) ?? []), e]);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => b - a)
      .map(([day, list]) => ({ day, list: list.sort((a, b) => b.timestamp - a.timestamp) }));
  }, [oilChecks, monthStart, monthEnd]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
        <View>
          <Text className="text-sm font-black text-gray-900 uppercase">Historique des contrôles</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Registre HACCP</Text>
        </View>
      </View>

      <View className="px-6 py-3 bg-white border-b border-gray-50 flex-row items-center justify-between">
        <Pressable
          disabled={!canGoBack}
          onPress={() => setMonth((m) => addMonths(m, -1))}
          className={cn('w-10 h-10 rounded-xl bg-gray-50 items-center justify-center', !canGoBack && 'opacity-40')}
        >
          <ChevronLeft size={18} color="#374151" />
        </Pressable>
        <Text className="text-xs font-black text-gray-900 uppercase tracking-widest">
          {format(month, 'MMMM yyyy', { locale: fr })}
        </Text>
        <Pressable
          disabled={!canGoForward}
          onPress={() => setMonth((m) => addMonths(m, 1))}
          className={cn('w-10 h-10 rounded-xl bg-gray-50 items-center justify-center', !canGoForward && 'opacity-40')}
        >
          <ChevronRight size={18} color="#374151" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24 }}>
        {days.length === 0 && (
          <View className="py-20 items-center">
            <Text className="text-sm text-gray-400 font-medium">Aucun contrôle ce mois-ci</Text>
          </View>
        )}

        {days.map(({ day, list }) => (
          <View key={day} className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {format(new Date(day), 'EEEE d MMMM yyyy', { locale: fr })}
            </Text>
            {list.map((entry) => {
              const Icon = entry.icon;
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => setSelected(entry)}
                  className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-3 active:bg-gray-50"
                >
                  <View className={cn('w-10 h-10 rounded-xl items-center justify-center', entry.ok ? 'bg-success/10' : 'bg-danger/10')}>
                    {entry.ok
                      ? <CheckCircle2 size={18} color="#10B981" />
                      : <XCircle size={18} color="#EF4444" />}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs font-black text-gray-900 uppercase">
                      {entry.control} — {entry.title}
                    </Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{entry.subtitle}</Text>
                  </View>
                  {entry.badge && (
                    <View className="px-2 py-1 rounded-lg bg-primary/10">
                      <Text className="text-[8px] font-black text-primary uppercase tracking-widest">{entry.badge}</Text>
                    </View>
                  )}
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="w-full bg-white rounded-3xl p-6 gap-5" style={{ maxWidth: 400 }}>
            <View className="items-center gap-2">
              <View className={cn('w-14 h-14 rounded-full items-center justify-center', selected?.ok ? 'bg-success/10' : 'bg-danger/10')}>
                {selected?.ok
                  ? <CheckCircle2 size={24} color="#10B981" />
                  : <XCircle size={24} color="#EF4444" />}
              </View>
              <Text className="text-base font-black uppercase text-gray-900 text-center">{selected?.control}</Text>
            </View>

            <View className="gap-3">
              {selected?.details.map(({ label, value }) => (
                <View key={label} className="bg-gray-50 p-3 rounded-xl">
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{label}</Text>
                  <Text className="text-xs font-bold text-gray-900 mt-1">{value}</Text>
                </View>
              ))}
            </View>

            <Pressable onPress={() => setSelected(null)} className="bg-gray-900 py-4 rounded-2xl">
              <Text className="text-white font-black uppercase text-xs text-center">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
