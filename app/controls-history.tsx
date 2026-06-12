import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Droplets, Thermometer, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../src/lib/useActive';
import { cn } from '../src/lib/utils';
import { targetLabel } from '../src/lib/fridgeTemp';
import { addMonths, endOfMonth, format, getDay, startOfDay, startOfMonth } from 'date-fns';
import { fr } from 'date-fns/locale';

// Historique des contrôles HACCP — un jour affiché à la fois, groupé par type
// de contrôle. Chaque contrôle du registre alimente la même liste en mappant
// ses enregistrements vers `DayEntry`.
interface DayEntry {
  id: string;
  control: string;
  icon: typeof Droplets;
  ok: boolean;
  title: string;
  subtitle: string;
  timestamp: number;
  // Optional pill shown on the card (e.g. "huile changée", "hors plage").
  badge?: string;
  badgeTone?: 'primary' | 'danger';
  // Rows shown in the detail modal when the card is tapped.
  details: { label: string; value: string }[];
}

export default function ControlsHistoryScreen() {
  const router = useRouter();
  const { oilChecks, fridgeTempChecks, storageUnits } = useActiveStore();
  const [selected, setSelected] = useState<DayEntry | null>(null);

  // One day displayed at a time — with several controls done every day, even
  // a month view grows too long; the day selector keeps the list short.
  const DAY = 86400000;
  const [day, setDay] = useState(() => startOfDay(new Date()).getTime());
  // Tapping the date collapses a calendar to jump to any past day directly.
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const dayStart = day;
  const dayEnd = day + DAY - 1;

  const earliest = useMemo(
    () => [...oilChecks, ...fridgeTempChecks].reduce((min, c) => Math.min(min, c.timestamp), Date.now()),
    [oilChecks, fridgeTempChecks]
  );
  const canGoBack = day > startOfDay(new Date(earliest)).getTime();
  const canGoForward = day < startOfDay(new Date()).getTime();

  const days = useMemo(() => {
    const entries: DayEntry[] = oilChecks
      .filter((c) => c.timestamp >= dayStart && c.timestamp <= dayEnd)
      .map((c) => ({
        id: c.id,
        control: 'Huiles de friture',
        icon: Droplets,
        ok: c.result === 'conforme',
        title: c.result === 'conforme' ? 'Conforme' : 'Non conforme',
        subtitle: format(new Date(c.timestamp), 'HH:mm', { locale: fr }),
        timestamp: c.timestamp,
        ...(c.oilChanged ? { badge: 'Huile changée' } : {}),
        details: [
          { label: 'Résultat', value: c.result === 'conforme' ? 'Conforme' : 'Non conforme' },
          { label: 'Huile changée', value: c.oilChanged ? 'Oui — récupération par organisme agréé' : 'Non' },
          { label: 'Date', value: format(new Date(c.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
          ...(c.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
          ...(c.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(c.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
          ...(c.notes ? [{ label: 'Notes', value: c.notes }] : []),
        ],
      }));

    const tempEntries: DayEntry[] = fridgeTempChecks
      .filter((c) => c.timestamp >= dayStart && c.timestamp <= dayEnd)
      .map((c) => {
        const unit = storageUnits.find((u) => u.id === c.unitId);
        const unitName = unit?.name ?? 'Enceinte';
        // Regulatory range shown in brackets next to the verdict, so it's
        // clear what the temperature was judged against.
        const target = unit ? targetLabel(unit.type) : '';
        const serviceLabel = c.service === 'debut' ? 'Début de service' : 'Fin de service';
        return {
          id: c.id,
          control: 'Températures',
          icon: Thermometer,
          ok: c.conform,
          title: `${unitName} • ${c.temperature}°C`,
          subtitle: `${serviceLabel} • ${format(new Date(c.timestamp), 'HH:mm', { locale: fr })}`,
          timestamp: c.timestamp,
          ...(c.conform ? {} : { badge: 'Hors plage', badgeTone: 'danger' as const }),
          details: [
            { label: 'Enceinte', value: unitName },
            { label: 'Température', value: `${c.temperature}°C` },
            { label: 'Conformité', value: `${c.conform ? 'Conforme' : 'Non conforme'}${target ? ` (cible : ${target})` : ''}` },
            { label: 'Service', value: serviceLabel },
            { label: 'Date', value: format(new Date(c.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
            ...(c.correctiveAction ? [{ label: 'Action corrective', value: c.correctiveAction }] : []),
            ...(c.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
            ...(c.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(c.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
          ],
        };
      });

    // Single day shown — group by control type for readability.
    const byControl = new Map<string, DayEntry[]>();
    for (const e of [...entries, ...tempEntries]) {
      byControl.set(e.control, [...(byControl.get(e.control) ?? []), e]);
    }
    return [...byControl.entries()]
      .map(([control, list]) => ({ control, list: list.sort((a, b) => b.timestamp - a.timestamp) }));
  }, [oilChecks, fridgeTempChecks, storageUnits, dayStart, dayEnd]);

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
          onPress={() => setDay((d) => d - DAY)}
          className={cn('w-10 h-10 rounded-xl bg-gray-50 items-center justify-center', !canGoBack && 'opacity-40')}
        >
          <ChevronLeft size={18} color="#374151" />
        </Pressable>
        <Pressable
          onPress={() => {
            setCalMonth(startOfMonth(new Date(day)));
            setShowCalendar((v) => !v);
          }}
          className="px-3 py-2 rounded-xl active:bg-gray-50"
        >
          <Text className="text-xs font-black text-gray-900 uppercase tracking-widest">
            {format(new Date(day), 'EEEE d MMMM yyyy', { locale: fr })}
          </Text>
        </Pressable>
        <Pressable
          disabled={!canGoForward}
          onPress={() => setDay((d) => d + DAY)}
          className={cn('w-10 h-10 rounded-xl bg-gray-50 items-center justify-center', !canGoForward && 'opacity-40')}
        >
          <ChevronRight size={18} color="#374151" />
        </Pressable>
      </View>

      {showCalendar && (
        <View className="px-6 py-4 bg-white border-b border-gray-50 gap-2">
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => setCalMonth((m) => addMonths(m, -1))} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
              <ChevronLeft size={18} color="#374151" />
            </Pressable>
            <Text className="text-sm font-black text-gray-900 uppercase">
              {format(calMonth, 'MMMM yyyy', { locale: fr })}
            </Text>
            <Pressable
              disabled={calMonth.getTime() >= startOfMonth(new Date()).getTime()}
              onPress={() => setCalMonth((m) => addMonths(m, 1))}
              className={cn('w-10 h-10 rounded-xl bg-gray-50 items-center justify-center', calMonth.getTime() >= startOfMonth(new Date()).getTime() && 'opacity-40')}
            >
              <ChevronRight size={18} color="#374151" />
            </Pressable>
          </View>

          <View className="flex-row">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <View key={i} className="flex-1 items-center py-1.5">
                <Text className="text-[10px] font-bold text-gray-400 uppercase">{d}</Text>
              </View>
            ))}
          </View>

          <View className="flex-row flex-wrap">
            {(() => {
              const last = endOfMonth(calMonth);
              const leadingBlanks = (getDay(startOfMonth(calMonth)) + 6) % 7;
              const todayDay = startOfDay(new Date()).getTime();
              const cells: React.ReactNode[] = [];
              for (let i = 0; i < leadingBlanks; i++) {
                cells.push(<View key={`b${i}`} style={{ width: '14.2857%' }} className="aspect-square" />);
              }
              for (let d = 1; d <= last.getDate(); d++) {
                const ts = new Date(calMonth.getFullYear(), calMonth.getMonth(), d).getTime();
                const disabled = ts > todayDay;
                const isPick = day === ts;
                cells.push(
                  <View key={d} style={{ width: '14.2857%' }} className="aspect-square p-0.5">
                    <Pressable
                      disabled={disabled}
                      onPress={() => { setDay(ts); setShowCalendar(false); }}
                      className={cn('flex-1 items-center justify-center rounded-xl', isPick ? 'bg-primary' : 'bg-transparent')}
                    >
                      <Text className={cn('text-xs font-bold', isPick ? 'text-white' : disabled ? 'text-gray-200' : 'text-gray-700')}>{d}</Text>
                    </Pressable>
                  </View>,
                );
              }
              return cells;
            })()}
          </View>
        </View>
      )}

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24 }}>
        {days.length === 0 && (
          <View className="py-20 items-center">
            <Text className="text-sm text-gray-400 font-medium">Aucun contrôle ce jour-là</Text>
          </View>
        )}

        {days.map(({ control, list }) => (
          <View key={control} className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {control} ({list.length})
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
                    <View className={cn('px-2 py-1 rounded-lg', entry.badgeTone === 'danger' ? 'bg-danger/10' : 'bg-primary/10')}>
                      <Text className={cn('text-[8px] font-black uppercase tracking-widest', entry.badgeTone === 'danger' ? 'text-danger' : 'text-primary')}>{entry.badge}</Text>
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
