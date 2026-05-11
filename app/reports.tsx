import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, Alert, BackHandler, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Download, Calendar, Search, Check, ChevronLeft, ChevronRight, X,
} from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { cn, formatDate, getStatusColor } from '../src/lib/utils';
import { generateAndShareReport, filterProducts, ReportFilter } from '../src/lib/pdf';
import { SafeAreaView } from 'react-native-safe-area-context';
import ZoneIcon from '../src/components/ZoneIcon';
import UnitIcon from '../src/components/UnitIcon';
import { addDays, addMonths, startOfDay, startOfMonth, endOfMonth, getDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

type Status = 'active' | 'used' | 'discarded';
type Range = 'today' | '7d' | '30d' | 'all' | 'custom';

export default function ReportsScreen() {
  const router = useRouter();
  const state = useStore();
  const { zones, storageUnits, shelves, bacs } = state;

  const [range, setRange] = useState<Range>('today');
  const [customFrom, setCustomFrom] = useState<number | null>(null);
  const [customTo, setCustomTo] = useState<number | null>(null);
  const [showCal, setShowCal] = useState<null | 'from' | 'to'>(null);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));

  const [statuses, setStatuses] = useState<Status[]>(['active']);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [shelfId, setShelfId] = useState<string | null>(null);
  const [bacId, setBacId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [productFilters, setProductFilters] = useState<string[]>([]);

  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeTraceability, setIncludeTraceability] = useState(true);
  const [includeActivity, setIncludeActivity] = useState(true);

  const [generating, setGenerating] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (showCal) { setShowCal(null); return true; }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [showCal])
  );

  const { from, to } = useMemo(() => {
    const now = Date.now();
    const today = startOfDay(new Date()).getTime();
    if (range === 'today') return { from: today, to: now };
    if (range === '7d') return { from: addDays(today, -6).getTime(), to: now };
    if (range === '30d') return { from: addDays(today, -29).getTime(), to: now };
    if (range === 'all') return { from: null, to: null };
    return { from: customFrom, to: customTo ? customTo + 86399999 : null };
  }, [range, customFrom, customTo]);

  const filter: ReportFilter = {
    from, to, statuses, zoneId, unitId, shelfId, bacId,
    search: search || undefined,
    productNames: productFilters.length > 0 ? productFilters : undefined,
    includeSummary, includeTraceability, includeActivity,
  };

  const matched = useMemo(() => filterProducts(state, filter), [state, filter]);

  const productSuggestions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const seen = new Set<string>(productFilters);
    const out: string[] = [];
    for (const p of state.products) {
      if (seen.has(p.name)) continue;
      if (p.name.toLowerCase().includes(q)) {
        seen.add(p.name);
        out.push(p.name);
        if (out.length >= 8) break;
      }
    }
    return out;
  }, [state.products, search, productFilters]);

  const toggleStatus = (s: Status) => {
    setStatuses((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const pickZone = (id: string | null) => { setZoneId(id); setUnitId(null); setShelfId(null); setBacId(null); };
  const pickUnit = (id: string | null) => { setUnitId(id); setShelfId(null); setBacId(null); };
  const pickShelf = (id: string | null) => { setShelfId(id); setBacId(null); };

  const unitsInZone = zoneId ? storageUnits.filter((u) => u.zoneId === zoneId) : [];
  const shelvesInUnit = unitId ? shelves.filter((s) => s.unitId === unitId) : [];
  const bacsInShelf = shelfId ? bacs.filter((b) => b.shelfId === shelfId) : [];

  const handleGenerate = async () => {
    if (statuses.length === 0) { Alert.alert('Erreur', 'Sélectionnez au moins un statut.'); return; }
    if (range === 'custom' && (!customFrom || !customTo)) { Alert.alert('Erreur', 'Sélectionnez une plage de dates.'); return; }
    try {
      setGenerating(true);
      await generateAndShareReport(state, filter);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || 'Génération du PDF échouée.');
    } finally {
      setGenerating(false);
    }
  };

  const rangeLabel = range === 'today' ? "Aujourd'hui"
    : range === '7d' ? '7 derniers jours'
    : range === '30d' ? '30 derniers jours'
    : range === 'all' ? 'Toute la période'
    : (customFrom && customTo) ? `${formatDate(customFrom)} → ${formatDate(customTo)}`
    : 'Personnalisé';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Rapports</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Générer un PDF HACCP</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24, paddingBottom: 120 }}>
        {/* Période */}
        <View className="gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Période</Text>
          <View className="flex-row flex-wrap gap-2">
            {([
              { id: 'today', label: "Aujourd'hui" },
              { id: '7d', label: '7 jours' },
              { id: '30d', label: '30 jours' },
              { id: 'all', label: 'Tout' },
              { id: 'custom', label: 'Personnalisé' },
            ] as const).map((r) => {
              const active = range === r.id;
              return (
                <Pressable key={r.id} onPress={() => setRange(r.id)} className={cn('px-4 py-2 rounded-xl', active ? 'bg-primary' : 'bg-gray-50')}>
                  <Text className={cn('text-[10px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {range === 'custom' && (
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => { setCalMonth(startOfMonth(customFrom ? new Date(customFrom) : new Date())); setShowCal('from'); }}
                className="flex-1 bg-white border-2 border-gray-100 p-3 rounded-2xl flex-row items-center gap-2"
              >
                <Calendar size={14} color="#9CA3AF" />
                <View>
                  <Text className="text-[8px] font-bold text-gray-400 uppercase">Du</Text>
                  <Text className="text-xs font-black text-gray-900">{customFrom ? formatDate(customFrom) : '—'}</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => { setCalMonth(startOfMonth(customTo ? new Date(customTo) : new Date())); setShowCal('to'); }}
                className="flex-1 bg-white border-2 border-gray-100 p-3 rounded-2xl flex-row items-center gap-2"
              >
                <Calendar size={14} color="#9CA3AF" />
                <View>
                  <Text className="text-[8px] font-bold text-gray-400 uppercase">Au</Text>
                  <Text className="text-xs font-black text-gray-900">{customTo ? formatDate(customTo) : '—'}</Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>

        {/* Statut */}
        <View className="gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Statut</Text>
          <View className="flex-row gap-2">
            {([
              { id: 'active', label: 'Actifs' },
              { id: 'used', label: 'Utilisés' },
              { id: 'discarded', label: 'Jetés' },
            ] as const).map((s) => {
              const active = statuses.includes(s.id);
              return (
                <Pressable key={s.id} onPress={() => toggleStatus(s.id)} className={cn('flex-1 py-3 rounded-xl border-2 items-center', active ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}>
                  <Text className={cn('text-[10px] font-black uppercase', active ? 'text-primary' : 'text-gray-400')}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Zone drill-down */}
        <View className="gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Emplacement</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Pressable onPress={() => pickZone(null)} className={cn('px-4 py-2 rounded-xl', !zoneId ? 'bg-primary' : 'bg-gray-50')}>
              <Text className={cn('text-[9px] font-black uppercase tracking-widest', !zoneId ? 'text-white' : 'text-gray-400')}>Tout</Text>
            </Pressable>
            {zones.map((z) => {
              const active = zoneId === z.id;
              return (
                <Pressable key={z.id} onPress={() => pickZone(active ? null : z.id)} className={cn('px-4 py-2 rounded-xl flex-row items-center gap-2', active ? 'bg-primary' : 'bg-gray-50')}>
                  <ZoneIcon type={z.type} size={12} color={active ? '#fff' : '#9CA3AF'} />
                  <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{z.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {unitsInZone.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => pickUnit(null)} className={cn('px-4 py-2 rounded-xl', !unitId ? 'bg-gray-900' : 'bg-gray-50')}>
                <Text className={cn('text-[9px] font-black uppercase tracking-widest', !unitId ? 'text-white' : 'text-gray-400')}>Tout</Text>
              </Pressable>
              {unitsInZone.map((u) => {
                const active = unitId === u.id;
                return (
                  <Pressable key={u.id} onPress={() => pickUnit(active ? null : u.id)} className={cn('px-4 py-2 rounded-xl flex-row items-center gap-2', active ? 'bg-gray-900' : 'bg-gray-50')}>
                    <UnitIcon type={u.type} size={12} color={active ? '#fff' : '#9CA3AF'} />
                    <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{u.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {shelvesInUnit.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => pickShelf(null)} className={cn('px-4 py-2 rounded-xl', !shelfId ? 'bg-gray-700' : 'bg-gray-50')}>
                <Text className={cn('text-[9px] font-black uppercase tracking-widest', !shelfId ? 'text-white' : 'text-gray-400')}>Tout</Text>
              </Pressable>
              {shelvesInUnit.map((s) => {
                const active = shelfId === s.id;
                return (
                  <Pressable key={s.id} onPress={() => pickShelf(active ? null : s.id)} className={cn('px-4 py-2 rounded-xl', active ? 'bg-gray-700' : 'bg-gray-50')}>
                    <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{s.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {bacsInShelf.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Pressable onPress={() => setBacId(null)} className={cn('px-4 py-2 rounded-xl', !bacId ? 'bg-gray-500' : 'bg-gray-50')}>
                <Text className={cn('text-[9px] font-black uppercase tracking-widest', !bacId ? 'text-white' : 'text-gray-400')}>Tout</Text>
              </Pressable>
              {bacsInShelf.map((b) => {
                const active = bacId === b.id;
                return (
                  <Pressable key={b.id} onPress={() => setBacId(active ? null : b.id)} className={cn('px-4 py-2 rounded-xl', active ? 'bg-gray-500' : 'bg-gray-50')}>
                    <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{b.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Recherche */}
        <View className="gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Produits</Text>

          {productFilters.length > 0 && (
            <View className="flex-row flex-wrap gap-2">
              {productFilters.map((name) => (
                <View key={name} className="flex-row items-center gap-2 px-4 py-2 rounded-xl bg-primary">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-white">{name}</Text>
                  <Pressable onPress={() => setProductFilters((prev) => prev.filter((n) => n !== name))} hitSlop={8}>
                    <X size={14} color="#fff" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <View>
            <View className="relative">
              <View className="absolute left-4 top-3.5 z-10"><Search size={16} color="#9CA3AF" /></View>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={productFilters.length > 0 ? 'Ajouter un produit...' : 'Nom du produit...'}
                className="pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl text-sm font-bold"
              />
            </View>
            {productSuggestions.length > 0 && (
              <View className="mt-2 bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {productSuggestions.map((name, i) => (
                  <Pressable
                    key={name}
                    onPress={() => { setProductFilters((prev) => [...prev, name]); setSearch(''); }}
                    className={cn('px-4 py-3 active:bg-gray-50', i > 0 && 'border-t border-gray-50')}
                  >
                    <Text className="text-sm font-bold text-gray-900">{name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Sections PDF */}
        <View className="gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Sections du PDF</Text>
          <View className="gap-2">
            {[
              { id: 'summary', label: 'Résumé conformité', value: includeSummary, set: setIncludeSummary },
              { id: 'trace', label: 'Tableau de traçabilité', value: includeTraceability, set: setIncludeTraceability },
              { id: 'activity', label: 'Historique d\'activité', value: includeActivity, set: setIncludeActivity },
            ].map((s) => (
              <Pressable key={s.id} onPress={() => s.set(!s.value)} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                <Text className="text-xs font-bold text-gray-900">{s.label}</Text>
                <View className={cn('w-6 h-6 rounded-md items-center justify-center', s.value ? 'bg-primary' : 'border-2 border-gray-200')}>
                  {s.value && <Check size={14} color="#fff" />}
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Aperçu</Text>
            <Text className="text-[9px] font-black text-primary uppercase">
              {matched.length} produit{matched.length !== 1 ? 's' : ''} · {rangeLabel}
            </Text>
          </View>
          {matched.length === 0 ? (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucun produit ne correspond</Text>
            </View>
          ) : (
            <View className="gap-2">
              {matched.slice(0, 50).map((p) => {
                const bac = bacs.find((b) => b.id === p.bacId);
                const isActive = p.status === 'active';
                const color = isActive ? getStatusColor(p.dlc) : (p.status === 'used' ? '#10B981' : '#EF4444');
                return (
                  <View key={p.id} className="bg-white p-3 rounded-xl border border-gray-100 flex-row items-center gap-3">
                    <View className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
                    <View className="flex-1">
                      <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{p.name}</Text>
                      <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" numberOfLines={1}>
                        {bac?.name ?? '—'} · {formatDate(isActive ? p.addedAt : p.modifiedAt)}
                      </Text>
                    </View>
                    <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: color + '20' }}>
                      <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>
                        {p.status === 'active' ? 'Actif' : p.status === 'used' ? 'Utilisé' : 'Jeté'}
                      </Text>
                    </View>
                  </View>
                );
              })}
              {matched.length > 50 && (
                <View className="py-3 items-center">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    +{matched.length - 50} autres dans le PDF
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* CTA */}
      <View className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 p-4">
        <Pressable
          onPress={handleGenerate}
          disabled={generating}
          className={cn('p-4 rounded-2xl flex-row items-center justify-center gap-2', generating ? 'bg-gray-300' : 'bg-primary')}
        >
          {generating
            ? <ActivityIndicator color="#fff" />
            : <Download size={18} color="#fff" />}
          <Text className="text-white font-black uppercase tracking-widest text-xs">
            {generating ? 'Génération...' : 'Générer le PDF'}
          </Text>
        </Pressable>
      </View>

      {/* Calendar modal */}
      <Modal visible={!!showCal} transparent animationType="fade" onRequestClose={() => setShowCal(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-6 gap-4" style={{ maxWidth: 380 }}>
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setCalMonth((m) => addMonths(m, -1))} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                <ChevronLeft size={18} color="#374151" />
              </Pressable>
              <Text className="text-sm font-black text-gray-900 uppercase">
                {format(calMonth, 'MMMM yyyy', { locale: fr })}
              </Text>
              <Pressable onPress={() => setCalMonth((m) => addMonths(m, 1))} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                <ChevronRight size={18} color="#374151" />
              </Pressable>
            </View>
            <View className="flex-row">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <View key={i} className="flex-1 items-center py-2">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase">{d}</Text>
                </View>
              ))}
            </View>
            <View className="flex-row flex-wrap">
              {(() => {
                const first = startOfMonth(calMonth);
                const last = endOfMonth(calMonth);
                const leadingBlanks = (getDay(first) + 6) % 7;
                const cells: React.ReactNode[] = [];
                for (let i = 0; i < leadingBlanks; i++) cells.push(<View key={`b${i}`} style={{ width: '14.2857%' }} className="aspect-square" />);
                const todayTs = startOfDay(new Date()).getTime();
                const selected = showCal === 'from' ? customFrom : customTo;
                for (let d = 1; d <= last.getDate(); d++) {
                  const date = new Date(calMonth.getFullYear(), calMonth.getMonth(), d);
                  const ts = date.getTime();
                  const isActive = selected ? startOfDay(new Date(selected)).getTime() === ts : false;
                  const isToday = todayTs === ts;
                  cells.push(
                    <View key={d} style={{ width: '14.2857%' }} className="aspect-square p-0.5">
                      <Pressable
                        onPress={() => {
                          if (showCal === 'from') setCustomFrom(ts);
                          else setCustomTo(ts);
                          setShowCal(null);
                        }}
                        className={cn('flex-1 items-center justify-center rounded-xl', isActive ? 'bg-primary' : isToday ? 'bg-primary/10' : 'bg-transparent')}
                      >
                        <Text className={cn('text-xs font-bold', isActive ? 'text-white' : isToday ? 'text-primary' : 'text-gray-700')}>{d}</Text>
                      </Pressable>
                    </View>
                  );
                }
                return cells;
              })()}
            </View>
            <Pressable onPress={() => setShowCal(null)} className="py-3 bg-gray-50 rounded-2xl">
              <Text className="text-gray-400 font-black uppercase text-xs text-center">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
