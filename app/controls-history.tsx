import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, CheckCircle2, ChefHat, ChevronDown, ChevronLeft, ChevronRight, Droplets, Sparkles, Thermometer, Truck, XCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../src/lib/useActive';
import { cn } from '../src/lib/utils';
import { targetLabel } from '../src/lib/fridgeTemp';
import { fabricationDetails } from '../src/lib/fabrication';
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
  const { oilChecks, fridgeTempChecks, fabrications, cleaningChecks, receptions, storageUnits } = useActiveStore();
  const [selected, setSelected] = useState<DayEntry | null>(null);
  // Which control group is expanded for the displayed day.
  const [openControl, setOpenControl] = useState<string | null>(null);

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
    () => [...oilChecks, ...fridgeTempChecks, ...fabrications, ...cleaningChecks, ...receptions].reduce((min, c) => Math.min(min, c.timestamp), Date.now()),
    [oilChecks, fridgeTempChecks, fabrications, cleaningChecks, receptions]
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
          ...(c.operatorName ? [{ label: 'Contrôleur', value: c.operatorName }] : []),
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
            ...(c.operatorName ? [{ label: 'Contrôleur', value: c.operatorName }] : []),
            { label: 'Date', value: format(new Date(c.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
            ...(c.correctiveAction ? [{ label: 'Action corrective', value: c.correctiveAction }] : []),
            ...(c.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
            ...(c.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(c.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
          ],
        };
      });

    const fabEntries: DayEntry[] = fabrications
      .filter((f) => f.timestamp >= dayStart && f.timestamp <= dayEnd)
      .map((f) => ({
        id: f.id,
        control: 'Fabrications',
        icon: ChefHat,
        ok: true,
        title: f.name,
        subtitle: `${format(new Date(f.timestamp), 'HH:mm', { locale: fr })}${f.typeLabel ? ` • ${f.typeLabel}` : ''}`,
        timestamp: f.timestamp,
        details: [
          { label: 'Préparation', value: f.name },
          ...(f.typeLabel ? [{ label: 'Type', value: f.typeLabel }] : []),
          ...fabricationDetails(f),
          ...(f.operatorName ? [{ label: 'Contrôleur', value: f.operatorName }] : []),
          { label: 'Date', value: format(new Date(f.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
          ...(f.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(f.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
        ],
      }));

    const cleaningEntries: DayEntry[] = cleaningChecks
      .filter((c) => c.timestamp >= dayStart && c.timestamp <= dayEnd)
      .map((c) => ({
        id: c.id,
        control: 'Nettoyage',
        icon: Sparkles,
        ok: c.result === 'conforme',
        title: c.area,
        subtitle: `${c.result === 'conforme' ? 'Conforme' : 'Non conforme'} • ${format(new Date(c.timestamp), 'HH:mm', { locale: fr })}`,
        timestamp: c.timestamp,
        ...(c.result === 'non_conforme' ? { badge: 'Non conforme', badgeTone: 'danger' as const } : {}),
        details: [
          { label: 'Zone', value: c.area },
          { label: 'Résultat', value: c.result === 'conforme' ? 'Conforme' : 'Non conforme' },
          ...(c.correctiveAction ? [{ label: 'Action corrective', value: c.correctiveAction }] : []),
          ...(c.operatorName ? [{ label: 'Contrôleur', value: c.operatorName }] : []),
          { label: 'Date', value: format(new Date(c.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
          ...(c.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
          ...(c.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(c.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
        ],
      }));

    const receptionEntries: DayEntry[] = receptions
      .filter((r) => r.timestamp >= dayStart && r.timestamp <= dayEnd)
      .map((r) => ({
        id: r.id,
        control: 'Réceptions',
        icon: Truck,
        ok: r.result === 'conforme',
        title: r.supplier,
        subtitle: `${format(new Date(r.timestamp), 'HH:mm', { locale: fr })}${r.reference ? ` • ${r.reference}` : ''}`,
        timestamp: r.timestamp,
        ...(r.result === 'non_conforme' ? { badge: 'Non conforme', badgeTone: 'danger' as const } : {}),
        details: [
          { label: 'Fournisseur', value: r.supplier },
          ...(r.reference ? [{ label: 'N° de BL / facture', value: r.reference }] : []),
          { label: 'Contrôle à réception', value: r.result === 'conforme' ? 'Conforme' : 'Non conforme' },
          ...(r.correctiveAction ? [{ label: 'Action corrective', value: r.correctiveAction }] : []),
          ...(r.operatorName ? [{ label: 'Contrôleur', value: r.operatorName }] : []),
          { label: 'Date', value: format(new Date(r.timestamp), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) },
          ...(r.backfilled ? [{ label: 'Saisie', value: 'A posteriori (jour complété plus tard)' }] : []),
          ...(r.recordedAt ? [{ label: 'Enregistré le', value: format(new Date(r.recordedAt), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr }) }] : []),
        ],
      }));

    // Single day shown — group by control type for readability.
    const byControl = new Map<string, DayEntry[]>();
    for (const e of [...entries, ...tempEntries, ...fabEntries, ...cleaningEntries, ...receptionEntries]) {
      byControl.set(e.control, [...(byControl.get(e.control) ?? []), e]);
    }
    return [...byControl.entries()]
      .map(([control, list]) => ({ control, list: list.sort((a, b) => b.timestamp - a.timestamp) }));
  }, [oilChecks, fridgeTempChecks, fabrications, cleaningChecks, receptions, storageUnits, dayStart, dayEnd]);

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

        {days.map(({ control, list }) => {
          const GroupIcon = list[0].icon;
          const issues = list.filter((e) => !e.ok).length;
          const open = openControl === control;
          return (
            <View key={control} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <Pressable
                onPress={() => setOpenControl(open ? null : control)}
                className="p-4 flex-row items-center gap-4 active:bg-gray-50"
              >
                <View className={cn('w-10 h-10 rounded-xl items-center justify-center', issues > 0 ? 'bg-danger/10' : 'bg-gray-100')}>
                  <GroupIcon size={18} color={issues > 0 ? '#EF4444' : '#6B7280'} />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-gray-900 uppercase">{control}</Text>
                  <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', issues > 0 ? 'text-danger' : 'text-gray-400')}>
                    {list.length} enregistrement{list.length > 1 ? 's' : ''}
                    {issues > 0 ? ` • ${issues} hors plage` : ''}
                  </Text>
                </View>
                {open ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
              </Pressable>

              {open && (
                <View className="border-t border-gray-50 p-3 gap-2">
                  {list.map((entry) => (
                    <Pressable
                      key={entry.id}
                      onPress={() => setSelected(entry)}
                      className="bg-gray-50 p-3 rounded-xl flex-row items-center gap-3 active:bg-gray-100"
                    >
                      <View className={cn('w-8 h-8 rounded-lg items-center justify-center', entry.ok ? 'bg-gray-100' : 'bg-danger/10')}>
                        {entry.ok
                          ? <CheckCircle2 size={15} color="#9CA3AF" />
                          : <XCircle size={15} color="#EF4444" />}
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs font-black text-gray-900 uppercase">{entry.title}</Text>
                        <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{entry.subtitle}</Text>
                      </View>
                      {entry.badge && (
                        <View className={cn('px-2 py-1 rounded-lg', entry.badgeTone === 'danger' ? 'bg-danger/10' : 'bg-primary/10')}>
                          <Text className={cn('text-[8px] font-black uppercase tracking-widest', entry.badgeTone === 'danger' ? 'text-danger' : 'text-primary')}>{entry.badge}</Text>
                        </View>
                      )}
                      <ChevronRight size={14} color="#D1D5DB" />
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          );
        })}
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
