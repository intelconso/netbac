import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, BackHandler, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Trash2, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, X, Boxes, Bug, LogOut, Scale, Check, ChefHat, Edit2, FileText, Sparkles, Tag, CalendarOff, CalendarDays, Thermometer, Users, ListChecks, Package, Layers } from 'lucide-react-native';
import { format, startOfMonth, endOfMonth, getDay, addMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { signOut } from '../../src/lib/firebase';
import { signOutGoogle } from '../../src/lib/googleSignIn';
import { useActiveStore } from '../../src/lib/useActive';
import { useStore } from '../../src/lib/store';
import { cn } from '../../src/lib/utils';
import { ActionType, ContainerType, StorageUnit, ZoneType } from '../../src/types';
import { ACTION_TYPES } from '../../src/lib/actionTypes';
import { PEST_CADENCES } from '../../src/lib/pestControl';
import CreateZoneModal from '../../src/components/CreateZoneModal';
import CreateUnitModal from '../../src/components/CreateUnitModal';
import CreateBacModal from '../../src/components/CreateBacModal';
import UnitIcon from '../../src/components/UnitIcon';
import ZoneIcon from '../../src/components/ZoneIcon';
import SyncRow from '../../src/components/SyncRow';
import FabricationTypesManager from '../../src/components/FabricationTypesManager';
import EmployeesManager from '../../src/components/EmployeesManager';
import TasksManager from '../../src/components/TasksManager';
import ArticlesManager from '../../src/components/ArticlesManager';
import CategoriesManager from '../../src/components/CategoriesManager';
import { WEEKDAYS, STATUS_LABELS, startOfDayMs } from '../../src/lib/serviceDays';
import { DayServiceStatus } from '../../src/types';
import { resolveTempUnits } from '../../src/lib/tempUnits';
import { targetLabel } from '../../src/lib/fridgeTemp';

// Types d'enceintes froides proposés pour le relevé de température (plage
// réglementaire dérivée du type — voir fridgeTemp.ts).
const COLD_TYPES: { value: StorageUnit['type']; label: string }[] = [
  { value: 'frigo', label: 'Frigo' },
  { value: 'saladette', label: 'Saladette' },
  { value: 'congelateur', label: 'Congélateur' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const {
    zones, storageUnits, shelves, bacs,
    addZone, deleteZone,
    addStorageUnit, deleteStorageUnit,
    addShelf, deleteShelf, setUnitShelves,
    addBac, deleteBac,
    productUnits, addProductUnit, updateProductUnit, deleteProductUnit,
    cleaningAreas, addCleaningArea, deleteCleaningArea,
    pestStations, addPestStation, deletePestStation,
  } = useActiveStore();
  const pestCadence = useStore((s) => s.pestCadence);
  const setPestCadence = useStore((s) => s.setPestCadence);
  // Direct selectors — useActiveStore destructure doesn't always re-render on
  // these new fields in Zustand 5; selectors guarantee a fresh subscription.
  const customActionTypes = useStore((s) => s.customActionTypes);
  const defaultActionTypeStates = useStore((s) => s.defaultActionTypeStates);
  const addCustomActionType = useStore((s) => s.addCustomActionType);
  const removeCustomActionType = useStore((s) => s.removeCustomActionType);
  const setDefaultActionTypeDisabled = useStore((s) => s.setDefaultActionTypeDisabled);
  const closedWeekdays = useStore((s) => s.closedWeekdays);
  const singleServiceWeekdays = useStore((s) => s.singleServiceWeekdays);
  const dayOverrides = useStore((s) => s.dayOverrides);
  const setWeekdayStatus = useStore((s) => s.setWeekdayStatus);
  const setDayOverride = useStore((s) => s.setDayOverride);
  const removeDayOverride = useStore((s) => s.removeDayOverride);
  const tempUnitsRaw = useStore((s) => s.tempUnits);
  const addTempUnit = useStore((s) => s.addTempUnit);
  const updateTempUnit = useStore((s) => s.updateTempUnit);
  const deleteTempUnit = useStore((s) => s.deleteTempUnit);
  const moveTempUnit = useStore((s) => s.moveTempUnit);
  const tempUnits = resolveTempUnits({ tempUnits: tempUnitsRaw, storageUnits });

  const [section, setSection] = useState<'menu' | 'structure' | 'custom' | 'units' | 'actionTypes' | 'fabricationTypes' | 'cleaningAreas' | 'tempUnits' | 'closedDays' | 'pestControl' | 'employees' | 'tasks' | 'articles' | 'articleCategories'>('menu');
  const [drillDown, setDrillDown] = useState<{ zoneId?: string; unitId?: string }>({});
  const [newUnit, setNewUnit] = useState('');
  const [newCleaningArea, setNewCleaningArea] = useState('');
  const [newPestNumber, setNewPestNumber] = useState('');
  const [newPestZone, setNewPestZone] = useState('');
  const [newTempName, setNewTempName] = useState('');
  const [newTempType, setNewTempType] = useState<StorageUnit['type']>('frigo');
  const [editingTemp, setEditingTemp] = useState<{ id: string; value: string } | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideMonth, setOverrideMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [overridePicked, setOverridePicked] = useState<number | null>(null);
  const [editingUnit, setEditingUnit] = useState<{ original: string; value: string } | null>(null);
  const [newActionLabel, setNewActionLabel] = useState('');
  const [newActionDays, setNewActionDays] = useState('3');
  const [actionTypeError, setActionTypeError] = useState<string | null>(null);
  const [confirmDeleteCustom, setConfirmDeleteCustom] = useState<{ id: string; label: string } | null>(null);
  const [confirmDisableDefault, setConfirmDisableDefault] = useState<{ id: ActionType; label: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (drillDown.unitId) {
          setDrillDown({ zoneId: drillDown.zoneId });
          return true;
        }
        if (drillDown.zoneId) {
          setDrillDown({});
          return true;
        }
        if (section === 'units' || section === 'actionTypes' || section === 'fabricationTypes' || section === 'cleaningAreas' || section === 'tempUnits' || section === 'closedDays' || section === 'pestControl' || section === 'employees' ||
            section === 'articleCategories') {
          setSection('custom');
          return true;
        }
        if (section !== 'menu') {
          setSection('menu');
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [drillDown.zoneId, drillDown.unitId, section])
  );

  const [isAddingZone, setIsAddingZone] = useState(false);
  const [addUnitForZoneId, setAddUnitForZoneId] = useState<string | null>(null);

  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');

  const [addBacShelfId, setAddBacShelfId] = useState<string | null>(null);

  const handleAddZone = (name: string, type: ZoneType) => {
    addZone({ name, type });
    setIsAddingZone(false);
  };

  const handleAddUnit = (zoneId: string, name: string, type: StorageUnit['type']) => {
    addStorageUnit({ name, zoneId, type });
    setAddUnitForZoneId(null);
  };

  const handleAddShelf = () => {
    const unitId = drillDown.unitId || storageUnits[0]?.id;
    if (!newShelfName || !unitId) return;
    const level = shelves.filter((s) => s.unitId === unitId).length + 1;
    addShelf({ name: newShelfName, unitId, level });
    setNewShelfName(''); setIsAddingShelf(false);
  };

  const handleAddBac = (shelfId: string, name: string, type: ContainerType) => {
    addBac({ shelfId, name, type });
    setAddBacShelfId(null);
  };

  const handleSignOut = () => {
    Alert.alert('Se déconnecter ?', 'Vous serez redirigé vers la page de connexion.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutGoogle();
            await signOut();
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de se déconnecter.');
          }
        },
      },
    ]);
  };

  const menuItems: { id: 'structure' | 'articles' | 'tasks' | 'custom' | 'reports'; label: string; description: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { id: 'structure', label: 'Structure', description: 'Zones, unités, niveaux, contenants', icon: Boxes },
    { id: 'tasks', label: 'Tâches', description: "Checklist de l'équipe & rappel quotidien", icon: ListChecks },
    { id: 'articles', label: 'Gestion de stock', description: "Catalogue d'ingrédients suivis en stock", icon: Package },
    { id: 'custom', label: 'Personnalisation', description: "Unités, catégories, types d'action", icon: Tag },
    { id: 'reports', label: 'Rapports', description: 'Générer un rapport HACCP en PDF', icon: FileText },
  ];

  const customItems: { id: 'units' | 'actionTypes' | 'fabricationTypes' | 'cleaningAreas' | 'tempUnits' | 'closedDays' | 'pestControl' | 'employees' | 'articleCategories'; label: string; description: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { id: 'employees', label: 'Équipe', description: 'Qui peut cocher les tâches', icon: Users },
    { id: 'units', label: 'Unités', description: 'Unités de mesure pour les produits', icon: Scale },
    { id: 'articleCategories', label: 'Catégories', description: "Classement des articles de l'inventaire", icon: Layers },
    { id: 'actionTypes', label: "Types d'action", description: 'Activer/désactiver les défauts, ajouter les vôtres', icon: Tag },
    { id: 'fabricationTypes', label: 'Types de fabrication', description: 'Champs des formulaires de fabrication', icon: ChefHat },
    { id: 'cleaningAreas', label: 'Zones de nettoyage', description: 'Zones du contrôle nettoyage quotidien', icon: Sparkles },
    { id: 'tempUnits', label: 'Zones de température', description: 'Zones du relevé de température quotidien', icon: Thermometer },
    { id: 'pestControl', label: 'Lutte contre les nuisibles', description: 'Pièges du plan & cadence des contrôles', icon: Bug },
    { id: 'closedDays', label: 'Jours & services', description: 'Fermetures, services uniques, exceptions', icon: CalendarOff },
  ];

  if (section === 'menu') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6">
          <Text className="text-sm font-black text-gray-900 uppercase">Paramètres</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Configuration du restaurant</Text>
        </View>

        <View className="gap-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={() => {
                  if (item.id === 'reports') router.push('/reports' as any);
                  else setSection(item.id);
                }}
                className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4"
              >
                <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                  <Icon size={20} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-gray-900 uppercase">{item.label}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{item.description}</Text>
                </View>
                <ChevronRight size={16} color="#D1D5DB" />
              </Pressable>
            );
          })}
          <SyncRow />
        </View>

        <Pressable
          onPress={handleSignOut}
          className="bg-white p-4 rounded-2xl border border-red-100 flex-row items-center gap-4 mt-8 active:bg-red-50"
        >
          <View className="w-12 h-12 rounded-xl bg-red-50 items-center justify-center">
            <LogOut size={20} color="#EF4444" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-red-500 uppercase">Déconnexion</Text>
            <Text className="text-[9px] font-bold text-red-400 uppercase tracking-widest mt-0.5">Quitter votre compte</Text>
          </View>
        </Pressable>
      </ScrollView>
    );
  }

  if (section === 'custom') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('menu')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Personnalisation</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Unités & types</Text>
          </View>
        </View>

        <View className="gap-3">
          {customItems.map((item) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={item.id}
                onPress={() => setSection(item.id)}
                className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4"
              >
                <View className="w-12 h-12 rounded-xl bg-primary/10 items-center justify-center">
                  <Icon size={20} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-black text-gray-900 uppercase">{item.label}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">{item.description}</Text>
                </View>
                <ChevronRight size={16} color="#D1D5DB" />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (section === 'closedDays') {
    const SEG: { value: DayServiceStatus; label: string }[] = [
      { value: 'open', label: 'Ouvert' },
      { value: 'single', label: 'Unique' },
      { value: 'closed', label: 'Fermé' },
    ];
    const segActiveClasses = (s: DayServiceStatus): string =>
      s === 'open' ? 'bg-success' : s === 'single' ? 'bg-blue-500' : 'bg-gray-700';
    const weekdayStatusOf = (wd: number): DayServiceStatus =>
      (closedWeekdays ?? []).includes(wd) ? 'closed'
        : (singleServiceWeekdays ?? []).includes(wd) ? 'single'
        : 'open';
    const statusDot = (s: DayServiceStatus): string =>
      s === 'open' ? '#10B981' : s === 'single' ? '#3B82F6' : '#6B7280';
    const liveOverrides = (dayOverrides ?? []).filter((o) => !o.deletedAt).sort((a, b) => a.date - b.date);

    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Jours & services</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Planning de service</Text>
          </View>
        </View>

        <View className="bg-white p-4 rounded-2xl border border-gray-100 mb-5">
          <Text className="text-[11px] font-medium text-gray-500">
            <Text className="font-bold text-success">Ouvert</Text> : service complet (température début + fin).{'\n'}
            <Text className="font-bold text-blue-600">Service unique</Text> : un seul relevé de température par enceinte ; huiles et nettoyage restent attendus.{'\n'}
            <Text className="font-bold text-gray-600">Fermé</Text> : aucun contrôle attendu ni compté comme manquant.
          </Text>
        </View>

        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Par défaut · chaque semaine</Text>
        <View className="gap-2 mb-6">
          {WEEKDAYS.map((d) => {
            const current = weekdayStatusOf(d.value);
            return (
              <View key={d.value} className="bg-white p-3 rounded-2xl border border-gray-100 gap-2.5">
                <Text className="text-xs font-black text-gray-900 uppercase">{d.label}</Text>
                <View className="flex-row p-1 bg-gray-100 rounded-xl gap-1">
                  {SEG.map((seg) => {
                    const active = current === seg.value;
                    return (
                      <Pressable
                        key={seg.value}
                        onPress={() => setWeekdayStatus(d.value, seg.value)}
                        className={cn('flex-1 py-2 rounded-lg items-center', active && segActiveClasses(seg.value))}
                      >
                        <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>
                          {seg.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>

        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Exceptions · dates précises</Text>
          <Pressable
            onPress={() => { setOverridePicked(null); setOverrideMonth(startOfMonth(new Date())); setShowOverrideModal(true); }}
            className="flex-row items-center gap-1"
          >
            <Plus size={12} color="#10B981" />
            <Text className="text-[10px] font-bold text-primary uppercase">Ajouter</Text>
          </Pressable>
        </View>
        <View className="gap-2">
          {liveOverrides.length === 0 ? (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Aucune exception — jour férié, ouverture exceptionnelle…
              </Text>
            </View>
          ) : liveOverrides.map((o) => (
            <View key={o.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: statusDot(o.status) + '1A' }}>
                <CalendarDays size={18} color={statusDot(o.status)} />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{format(new Date(o.date), 'EEE d MMM yyyy', { locale: fr })}</Text>
                <Text className="text-[9px] font-bold uppercase tracking-widest mt-0.5" style={{ color: statusDot(o.status) }}>{STATUS_LABELS[o.status]}</Text>
              </View>
              <Pressable onPress={() => removeDayOverride(o.date)} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            </View>
          ))}
        </View>

        <Modal visible={showOverrideModal} transparent animationType="fade" onRequestClose={() => setShowOverrideModal(false)}>
          <View className="flex-1 bg-black/60 items-center justify-center p-6">
            <View className="bg-white w-full rounded-3xl p-5 gap-4" style={{ maxWidth: 420 }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-black text-gray-900 uppercase">Ajouter une exception</Text>
                <Pressable onPress={() => setShowOverrideModal(false)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                  <X size={18} color="#9CA3AF" />
                </Pressable>
              </View>

              <View className="flex-row items-center justify-between">
                <Pressable onPress={() => setOverrideMonth((m) => addMonths(m, -1))} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                  <ChevronLeft size={18} color="#374151" />
                </Pressable>
                <Text className="text-sm font-black text-gray-900 uppercase">{format(overrideMonth, 'MMMM yyyy', { locale: fr })}</Text>
                <Pressable onPress={() => setOverrideMonth((m) => addMonths(m, 1))} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                  <ChevronRight size={18} color="#374151" />
                </Pressable>
              </View>

              <View className="flex-row">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <View key={i} className="flex-1 items-center py-1">
                    <Text className="text-[10px] font-bold text-gray-400 uppercase">{d}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-row flex-wrap">
                {(() => {
                  const last = endOfMonth(overrideMonth);
                  const leadingBlanks = (getDay(startOfMonth(overrideMonth)) + 6) % 7;
                  const cells: React.ReactNode[] = [];
                  for (let i = 0; i < leadingBlanks; i++) {
                    cells.push(<View key={`b${i}`} style={{ width: '14.2857%' }} className="aspect-square" />);
                  }
                  for (let d = 1; d <= last.getDate(); d++) {
                    const ts = new Date(overrideMonth.getFullYear(), overrideMonth.getMonth(), d).getTime();
                    const isPick = overridePicked === ts;
                    const ov = liveOverrides.find((o) => startOfDayMs(o.date) === ts);
                    cells.push(
                      <View key={d} style={{ width: '14.2857%' }} className="aspect-square p-0.5">
                        <Pressable
                          onPress={() => setOverridePicked(ts)}
                          className={cn('flex-1 items-center justify-center rounded-xl', isPick ? 'bg-primary' : 'bg-gray-50')}
                        >
                          <Text className={cn('text-xs font-bold', isPick ? 'text-white' : 'text-gray-700')}>{d}</Text>
                          {ov && <View className="w-1.5 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: isPick ? '#fff' : statusDot(ov.status) }} />}
                        </Pressable>
                      </View>,
                    );
                  }
                  return cells;
                })()}
              </View>

              {overridePicked !== null && (
                <View className="gap-2 pt-1">
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    Statut · {format(new Date(overridePicked), 'EEEE d MMMM', { locale: fr })}
                  </Text>
                  <View className="flex-row gap-2">
                    {SEG.map((seg) => (
                      <Pressable
                        key={seg.value}
                        onPress={() => { setDayOverride(overridePicked, seg.value); setShowOverrideModal(false); setOverridePicked(null); }}
                        className={cn('flex-1 py-3 rounded-xl items-center', segActiveClasses(seg.value))}
                      >
                        <Text className="text-[10px] font-black uppercase text-white">{seg.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </ScrollView>
    );
  }

  if (section === 'tempUnits') {
    const handleAddTemp = () => {
      if (!newTempName.trim()) return;
      addTempUnit(newTempName, newTempType);
      setNewTempName('');
    };
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Zones de température</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Relevé de température quotidien</Text>
          </View>
        </View>

        <View className="bg-white p-4 rounded-2xl border border-gray-100 mb-4">
          <Text className="text-[11px] font-medium text-gray-500">
            Initialisée depuis les enceintes froides de votre <Text className="font-bold">Structure</Text>. Vous pouvez ensuite l'ajuster librement ici — renommer, supprimer ou ajouter — sans toucher à la structure. L'<Text className="font-bold">ordre</Text> ci-dessous est l'ordre de saisie du relevé quotidien.
          </Text>
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 p-2 mb-4 gap-2">
          <TextInput
            value={newTempName}
            onChangeText={setNewTempName}
            placeholder="ex: Frigo bar, Chambre froide..."
            className="px-3 py-2 text-sm font-bold text-gray-900"
            onSubmitEditing={handleAddTemp}
            returnKeyType="done"
          />
          <View className="flex-row gap-2 items-center">
            <View className="flex-1 flex-row p-1 bg-gray-100 rounded-xl gap-1">
              {COLD_TYPES.map((t) => {
                const active = newTempType === t.value;
                return (
                  <Pressable key={t.value} onPress={() => setNewTempType(t.value)} className={cn('flex-1 py-2 rounded-lg items-center', active && 'bg-primary')}>
                    <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable
              onPress={handleAddTemp}
              disabled={!newTempName.trim()}
              className={cn('w-10 h-10 rounded-xl items-center justify-center', newTempName.trim() ? 'bg-primary' : 'bg-gray-100')}
            >
              <Plus size={18} color={newTempName.trim() ? '#fff' : '#9CA3AF'} />
            </Pressable>
          </View>
        </View>

        <View className="gap-2">
          {tempUnits.map((unit, idx) => {
            const isEditing = editingTemp?.id === unit.id;
            return (
              <View key={unit.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-2">
                {isEditing ? (
                  <>
                    <TextInput
                      value={editingTemp!.value}
                      onChangeText={(v) => setEditingTemp({ id: unit.id, value: v })}
                      autoFocus
                      className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold text-gray-900"
                    />
                    <Pressable
                      onPress={() => {
                        if (editingTemp!.value.trim() && editingTemp!.value.trim() !== unit.name) {
                          updateTempUnit(unit.id, { name: editingTemp!.value });
                        }
                        setEditingTemp(null);
                      }}
                      className="w-10 h-10 rounded-xl bg-primary items-center justify-center"
                    >
                      <Check size={18} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => setEditingTemp(null)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                      <X size={18} color="#9CA3AF" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                      <Thermometer size={18} color="#10B981" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-black text-gray-900 uppercase">{unit.name}</Text>
                      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{targetLabel(unit.type)}</Text>
                    </View>
                    <View className="rounded-xl bg-gray-50 overflow-hidden">
                      <Pressable
                        onPress={() => moveTempUnit(unit.id, 'up')}
                        disabled={idx === 0}
                        className={cn('w-8 h-5 items-center justify-center', idx === 0 && 'opacity-30')}
                      >
                        <ChevronUp size={14} color="#6B7280" />
                      </Pressable>
                      <Pressable
                        onPress={() => moveTempUnit(unit.id, 'down')}
                        disabled={idx === tempUnits.length - 1}
                        className={cn('w-8 h-5 items-center justify-center', idx === tempUnits.length - 1 && 'opacity-30')}
                      >
                        <ChevronDown size={14} color="#6B7280" />
                      </Pressable>
                    </View>
                    <Pressable onPress={() => setEditingTemp({ id: unit.id, value: unit.name })} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                      <Edit2 size={16} color="#9CA3AF" />
                    </Pressable>
                    <Pressable onPress={() => deleteTempUnit(unit.id)} className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
          {tempUnits.length === 0 && (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Aucune enceinte — ajoutez-en une</Text>
            </View>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'pestControl') {
    const addStation = () => {
      if (!newPestNumber.trim() && !newPestZone.trim()) return;
      addPestStation({ number: newPestNumber, zone: newPestZone });
      setNewPestNumber('');
      setNewPestZone('');
    };
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Lutte contre les nuisibles</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Plan & cadence des contrôles</Text>
          </View>
        </View>

        {/* Cadence — pilote le calcul du prochain contrôle. */}
        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Cadence des contrôles</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {PEST_CADENCES.map((c) => {
            const active = (pestCadence ?? 'weekly') === c.value;
            return (
              <Pressable
                key={c.value}
                onPress={() => setPestCadence(c.value)}
                className={cn('px-3 py-2.5 rounded-xl border', active ? 'bg-primary/10 border-primary' : 'bg-white border-gray-100')}
              >
                <Text className={cn('text-[10px] font-black uppercase', active ? 'text-primary' : 'text-gray-400')}>{c.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Pièges / appâts du plan — n° + zone (mêmes infos que le plan papier). */}
        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Pièges / appâts du plan</Text>
        <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center gap-2 p-2 mb-4">
          <TextInput
            value={newPestNumber}
            onChangeText={setNewPestNumber}
            placeholder="N°"
            className="w-16 px-3 py-2 text-sm font-bold text-gray-900"
          />
          <TextInput
            value={newPestZone}
            onChangeText={setNewPestZone}
            placeholder="Zone (ex: Cuisine, Réserve...)"
            className="flex-1 px-3 py-2 text-sm font-bold text-gray-900"
            onSubmitEditing={addStation}
            returnKeyType="done"
          />
          <Pressable
            onPress={addStation}
            disabled={!newPestNumber.trim() && !newPestZone.trim()}
            className={cn('w-10 h-10 rounded-xl items-center justify-center', (newPestNumber.trim() || newPestZone.trim()) ? 'bg-primary' : 'bg-gray-100')}
          >
            <Plus size={18} color={(newPestNumber.trim() || newPestZone.trim()) ? '#fff' : '#9CA3AF'} />
          </Pressable>
        </View>

        <View className="gap-2">
          {pestStations.map((s) => (
            <View key={s.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <Bug size={18} color="#10B981" />
              </View>
              <Text className="flex-1 text-sm font-black text-gray-900 uppercase">{s.number ? `${s.number} · ` : ''}{s.zone}</Text>
              <Pressable onPress={() => deletePestStation(s.id)} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            </View>
          ))}
          {pestStations.length === 0 && (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucun piège — ajoutez-en un</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  if (section === 'cleaningAreas') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Zones de nettoyage</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Contrôle nettoyage quotidien</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center gap-2 p-2 mb-4">
          <TextInput
            value={newCleaningArea}
            onChangeText={setNewCleaningArea}
            placeholder="ex: Terrasse, Sanitaires..."
            className="flex-1 px-3 py-2 text-sm font-bold text-gray-900"
            onSubmitEditing={() => { if (newCleaningArea.trim()) { addCleaningArea(newCleaningArea); setNewCleaningArea(''); } }}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => { if (newCleaningArea.trim()) { addCleaningArea(newCleaningArea); setNewCleaningArea(''); } }}
            disabled={!newCleaningArea.trim()}
            className={cn('w-10 h-10 rounded-xl items-center justify-center', newCleaningArea.trim() ? 'bg-primary' : 'bg-gray-100')}
          >
            <Plus size={18} color={newCleaningArea.trim() ? '#fff' : '#9CA3AF'} />
          </Pressable>
        </View>

        <View className="gap-2">
          {cleaningAreas.map((area) => (
            <View key={area} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                <Sparkles size={18} color="#10B981" />
              </View>
              <Text className="flex-1 text-sm font-black text-gray-900 uppercase">{area}</Text>
              <Pressable onPress={() => deleteCleaningArea(area)} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                <Trash2 size={14} color="#EF4444" />
              </Pressable>
            </View>
          ))}
          {cleaningAreas.length === 0 && (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucune zone — ajoutez-en une</Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  if (section === 'units') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Unités</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Unités de mesure</Text>
          </View>
        </View>

        <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center gap-2 p-2 mb-4">
          <TextInput
            value={newUnit}
            onChangeText={setNewUnit}
            placeholder="ex: kg, g, pce, broche..."
            className="flex-1 px-3 py-2 text-sm font-bold text-gray-900"
            autoCapitalize="none"
            onSubmitEditing={() => { if (newUnit.trim()) { addProductUnit(newUnit); setNewUnit(''); } }}
            returnKeyType="done"
          />
          <Pressable
            onPress={() => { if (newUnit.trim()) { addProductUnit(newUnit); setNewUnit(''); } }}
            disabled={!newUnit.trim()}
            className={cn('w-10 h-10 rounded-xl items-center justify-center', newUnit.trim() ? 'bg-primary' : 'bg-gray-100')}
          >
            <Plus size={18} color={newUnit.trim() ? '#fff' : '#9CA3AF'} />
          </Pressable>
        </View>

        <View className="gap-2">
          {productUnits.length === 0 ? (
            <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucune unité</Text>
            </View>
          ) : productUnits.map((u) => {
            const isEditing = editingUnit?.original === u;
            return (
              <View key={u} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-2">
                {isEditing ? (
                  <>
                    <TextInput
                      value={editingUnit!.value}
                      onChangeText={(v) => setEditingUnit({ original: u, value: v })}
                      autoFocus
                      className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold text-gray-900"
                    />
                    <Pressable
                      onPress={() => {
                        if (editingUnit!.value.trim() && editingUnit!.value.trim() !== u) {
                          updateProductUnit(u, editingUnit!.value);
                        }
                        setEditingUnit(null);
                      }}
                      className="w-10 h-10 rounded-xl bg-primary items-center justify-center"
                    >
                      <Check size={18} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => setEditingUnit(null)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                      <X size={18} color="#9CA3AF" />
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text className="flex-1 px-3 text-sm font-black text-gray-900 uppercase">{u}</Text>
                    <Pressable onPress={() => setEditingUnit({ original: u, value: u })} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                      <Edit2 size={16} color="#9CA3AF" />
                    </Pressable>
                    <Pressable onPress={() => deleteProductUnit(u)} className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                      <Trash2 size={16} color="#EF4444" />
                    </Pressable>
                  </>
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (section === 'tasks' || section === 'employees' || section === 'articles' || section === 'articleCategories') {
    const managers = {
      tasks: { title: 'Tâches', subtitle: "Checklist de l'équipe", node: <TasksManager /> },
      employees: { title: 'Équipe', subtitle: 'Membres du restaurant', node: <EmployeesManager /> },
      articles: { title: 'Gestion de stock', subtitle: 'Catalogue des articles suivis', node: <ArticlesManager /> },
      articleCategories: {
        title: 'Catégories',
        subtitle: "Classement du catalogue d'inventaire",
        node: <CategoriesManager alwaysOpen />,
      },
    } as const;
    const manager = managers[section];
    // Articles et Tâches sont des entrées de premier niveau des Paramètres,
    // Équipe et Catégories vivent sous Personnalisation : le retour suit d'où
    // l'on vient.
    const parent = section === 'articles' || section === 'tasks' ? 'menu' : 'custom';
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <View className="mb-6 flex-row items-center gap-3">
            <Pressable onPress={() => setSection(parent)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
              <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
            <View>
              <Text className="text-sm font-black text-gray-900 uppercase">{manager.title}</Text>
              <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
                {manager.subtitle}
              </Text>
            </View>
          </View>
          {manager.node}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'fabricationTypes') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-background">
        <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
          <View className="mb-6 flex-row items-center gap-3">
            <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
              <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
            <View>
              <Text className="text-sm font-black text-gray-900 uppercase">Types de fabrication</Text>
              <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Champs des formulaires</Text>
            </View>
          </View>
          <FabricationTypesManager />
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  if (section === 'actionTypes') {
    const disabledById = new Map((defaultActionTypeStates ?? []).map((s) => [s.id, s.disabled]));
    const liveCustoms = (customActionTypes ?? []).filter((c) => !c.deletedAt);
    const MIN_DLC_DAYS = 1;
    const handleAddAction = () => {
      const label = newActionLabel.trim();
      const days = parseInt(newActionDays, 10);
      if (!label) {
        setActionTypeError('Donne un nom au type.');
        return;
      }
      if (isNaN(days) || days < MIN_DLC_DAYS) {
        setActionTypeError(`La DLC doit être d'au moins ${MIN_DLC_DAYS} jour.`);
        return;
      }
      addCustomActionType({ label, dlcDays: days });
      setNewActionLabel('');
      setNewActionDays('3');
      setActionTypeError(null);
    };
    const performRemoveAction = (id: string) => {
      const res = removeCustomActionType(id);
      if (!res.ok) setActionTypeError(res.error ?? null);
      else setActionTypeError(null);
      setConfirmDeleteCustom(null);
    };
    const performDisableDefault = (id: ActionType) => {
      setDefaultActionTypeDisabled(id, true);
      setConfirmDisableDefault(null);
    };
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 24, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('custom')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Types d'action</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Défauts + personnalisés</Text>
          </View>
        </View>

        <View className="gap-6">
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Types par défaut</Text>
            {ACTION_TYPES.map((def) => {
              const Icon = def.icon;
              const disabled = disabledById.get(def.id as ActionType) === true;
              return (
                <View key={def.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
                  <View className={cn('w-10 h-10 rounded-xl items-center justify-center', disabled ? 'bg-gray-100' : 'bg-primary/10')}>
                    <Icon size={18} color={disabled ? '#9CA3AF' : '#10B981'} />
                  </View>
                  <View className="flex-1">
                    <Text className={cn('text-sm font-black uppercase', disabled ? 'text-gray-400' : 'text-gray-900')}>{def.label}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">DLC défaut: {def.dlcDays} j</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      if (disabled) setDefaultActionTypeDisabled(def.id as ActionType, false);
                      else setConfirmDisableDefault({ id: def.id as ActionType, label: def.label });
                    }}
                    className={cn('px-3 py-1.5 rounded-xl', disabled ? 'bg-gray-100' : 'bg-success/10')}
                  >
                    <Text className={cn('text-[10px] font-black uppercase', disabled ? 'text-gray-500' : 'text-success')}>
                      {disabled ? 'Désactivé' : 'Activé'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vos types personnalisés</Text>
            <View className="bg-white rounded-2xl border border-gray-100 p-3 gap-2">
              <TextInput
                value={newActionLabel}
                onChangeText={setNewActionLabel}
                placeholder="Nom (ex: Mariné, Saumuré...)"
                className="px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold text-gray-900"
              />
              <View className="flex-row gap-2 items-center">
                <Text className="text-[10px] font-bold text-gray-400 uppercase">DLC (jours)</Text>
                <TextInput
                  value={newActionDays}
                  onChangeText={setNewActionDays}
                  keyboardType="number-pad"
                  className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm font-bold text-gray-900"
                />
                <Pressable
                  onPress={handleAddAction}
                  disabled={!newActionLabel.trim()}
                  className={cn('w-10 h-10 rounded-xl items-center justify-center', newActionLabel.trim() ? 'bg-primary' : 'bg-gray-100')}
                >
                  <Plus size={18} color={newActionLabel.trim() ? '#fff' : '#9CA3AF'} />
                </Pressable>
              </View>
            </View>

            {actionTypeError && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-3">
                <Text className="text-[10px] font-bold text-red-700">{actionTypeError}</Text>
              </View>
            )}

            {liveCustoms.length === 0 ? (
              <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucun type personnalisé</Text>
              </View>
            ) : (
              liveCustoms.map((c) => (
                <View key={c.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                    <Tag size={18} color="#10B981" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-black text-gray-900 uppercase">{c.label}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">DLC défaut: {c.dlcDays} j</Text>
                  </View>
                  <Pressable onPress={() => setConfirmDeleteCustom({ id: c.id, label: c.label })} className="w-10 h-10 rounded-xl bg-red-50 items-center justify-center">
                    <Trash2 size={16} color="#EF4444" />
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <Modal visible={!!confirmDeleteCustom} transparent animationType="fade" onRequestClose={() => setConfirmDeleteCustom(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-6 gap-4" style={{ maxWidth: 400 }}>
            <View className="items-center gap-1">
              <View className="w-14 h-14 rounded-full bg-red-50 items-center justify-center mb-1">
                <Trash2 size={24} color="#EF4444" />
              </View>
              <Text className="text-base font-black uppercase text-gray-900 text-center">Supprimer le type ?</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{confirmDeleteCustom?.label}</Text>
              <Text className="text-[11px] font-medium text-gray-500 text-center mt-2">
                Bloquée si des étiquettes <Text className="font-bold">actives</Text> utilisent encore ce type. L'historique (utilisées / jetées) reste affichable.
              </Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setConfirmDeleteCustom(null)} className="flex-1 bg-gray-50 py-3 rounded-2xl">
                <Text className="text-gray-400 font-black uppercase text-xs text-center">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDeleteCustom && performRemoveAction(confirmDeleteCustom.id)}
                className="flex-[2] bg-danger py-3 rounded-2xl"
              >
                <Text className="text-white font-black uppercase text-xs text-center">Supprimer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirmDisableDefault} transparent animationType="fade" onRequestClose={() => setConfirmDisableDefault(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-6 gap-4" style={{ maxWidth: 400 }}>
            <View className="items-center gap-1">
              <View className="w-14 h-14 rounded-full bg-gray-100 items-center justify-center mb-1">
                <X size={24} color="#6B7280" />
              </View>
              <Text className="text-base font-black uppercase text-gray-900 text-center">Désactiver ?</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">{confirmDisableDefault?.label}</Text>
              <Text className="text-[11px] font-medium text-gray-500 text-center mt-2">N'apparaîtra plus dans le picker. Les étiquettes existantes restent intactes. Réactivable à tout moment.</Text>
            </View>
            <View className="flex-row gap-3">
              <Pressable onPress={() => setConfirmDisableDefault(null)} className="flex-1 bg-gray-50 py-3 rounded-2xl">
                <Text className="text-gray-400 font-black uppercase text-xs text-center">Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => confirmDisableDefault && performDisableDefault(confirmDisableDefault.id)}
                className="flex-[2] bg-gray-900 py-3 rounded-2xl"
              >
                <Text className="text-white font-black uppercase text-xs text-center">Désactiver</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
      <View className="mb-6 flex-row items-center gap-3">
        <Pressable onPress={() => setSection('menu')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
          <ChevronRight size={20} color="#9CA3AF" style={{ transform: [{ rotate: '180deg' }] }} />
        </Pressable>
        <View>
          <Text className="text-sm font-black text-gray-900 uppercase">Structure</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Zones, unités, contenants</Text>
        </View>
      </View>

      <View className="gap-6">
          <View className="flex-row items-center gap-2">
            <Pressable onPress={() => setDrillDown({})}>
              <Text className={cn('text-[10px] font-black uppercase tracking-widest', !drillDown.zoneId ? 'text-primary' : 'text-gray-400')}>
                Restaurant
              </Text>
            </Pressable>
            {drillDown.zoneId && (
              <>
                <ChevronRight size={12} color="#D1D5DB" />
                <Pressable onPress={() => setDrillDown({ zoneId: drillDown.zoneId })}>
                  <Text className={cn('text-[10px] font-black uppercase tracking-widest', drillDown.zoneId && !drillDown.unitId ? 'text-primary' : 'text-gray-400')}>
                    {zones.find((z) => z.id === drillDown.zoneId)?.name}
                  </Text>
                </Pressable>
              </>
            )}
            {drillDown.unitId && (
              <>
                <ChevronRight size={12} color="#D1D5DB" />
                <Text className="text-[10px] font-black uppercase tracking-widest text-primary">
                  {storageUnits.find((u) => u.id === drillDown.unitId)?.name}
                </Text>
              </>
            )}
          </View>

          {!drillDown.zoneId && (
            <View className="gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Zones (Lieux)</Text>
                <Pressable onPress={() => setIsAddingZone(true)} className="flex-row items-center gap-1">
                  <Plus size={12} color="#10B981" />
                  <Text className="text-[10px] font-bold text-primary uppercase">Nouvelle Zone</Text>
                </Pressable>
              </View>
              {zones.map((zone) => (
                <Pressable key={zone.id} onPress={() => setDrillDown({ zoneId: zone.id })} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                      <ZoneIcon type={zone.type} size={18} />
                    </View>
                    <View>
                      <Text className="text-sm font-black text-gray-900 uppercase">{zone.name}</Text>
                      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {storageUnits.filter((u) => u.zoneId === zone.id).length} Unités
                      </Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Pressable onPress={() => deleteZone(zone.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                    <ChevronRight size={16} color="#D1D5DB" />
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {drillDown.zoneId && !drillDown.unitId && (
            <View className="gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unités</Text>
                <Pressable onPress={() => drillDown.zoneId && setAddUnitForZoneId(drillDown.zoneId)} className="flex-row items-center gap-1">
                  <Plus size={12} color="#10B981" />
                  <Text className="text-[10px] font-bold text-primary uppercase">Nouvelle Unité</Text>
                </Pressable>
              </View>
              {storageUnits.filter((u) => u.zoneId === drillDown.zoneId).map((unit) => {
                const shelfCount = shelves.filter((s) => s.unitId === unit.id).length;
                return (
                  <Pressable key={unit.id} onPress={() => setDrillDown({ zoneId: drillDown.zoneId, unitId: unit.id })} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4 flex-1">
                      <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                        <UnitIcon type={unit.type} size={18} />
                      </View>
                      <View>
                        <Text className="text-sm font-black text-gray-900 uppercase">{unit.name}</Text>
                        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{shelfCount} niveaux</Text>
                      </View>
                    </View>
                    <View className="flex-row items-center gap-2 bg-gray-50 px-2 py-1 rounded-xl border border-gray-100">
                      <Pressable onPress={() => shelfCount > 1 && setUnitShelves(unit.id, shelfCount - 1)} className="w-6 h-6 rounded-lg bg-white items-center justify-center">
                        <Text className="text-gray-400">-</Text>
                      </Pressable>
                      <Text className="text-xs font-black text-primary w-4 text-center">{shelfCount}</Text>
                      <Pressable onPress={() => shelfCount < 10 && setUnitShelves(unit.id, shelfCount + 1)} className="w-6 h-6 rounded-lg bg-white items-center justify-center">
                        <Text className="text-gray-400">+</Text>
                      </Pressable>
                    </View>
                    <Pressable onPress={() => deleteStorageUnit(unit.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                  </Pressable>
                );
              })}
            </View>
          )}

          {drillDown.unitId && (
            <View className="gap-4">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Détail des Niveaux</Text>
              {shelves.filter((s) => s.unitId === drillDown.unitId).sort((a, b) => a.level - b.level).map((shelf) => (
                <View key={shelf.id} className="bg-white p-4 rounded-2xl border border-gray-100 gap-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                      <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                        <Text className="text-primary font-black text-xs">{shelf.level}</Text>
                      </View>
                      <Text className="text-sm font-black text-gray-900 uppercase">{shelf.name}</Text>
                    </View>
                    <Pressable onPress={() => deleteShelf(shelf.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                  </View>
                  <View className="flex-row flex-wrap gap-2 pl-11">
                    {bacs.filter((b) => b.shelfId === shelf.id).map((bac) => (
                      <View key={bac.id} className="bg-gray-50 px-3 py-2 rounded-xl flex-row items-center gap-2 border border-gray-100">
                        <Text className="text-[10px] font-bold text-gray-600 uppercase">{bac.name}</Text>
                        <Pressable onPress={() => deleteBac(bac.id)}><X size={12} color="#D1D5DB" /></Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => setAddBacShelfId(shelf.id)}
                      className="px-3 py-2 rounded-xl border border-dashed border-gray-300 flex-row items-center gap-1"
                    >
                      <Plus size={12} color="#9CA3AF" />
                      <Text className="text-[10px] font-bold text-gray-400 uppercase">Ajouter</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

      <CreateBacModal
        shelfId={addBacShelfId}
        onClose={() => setAddBacShelfId(null)}
        onSubmit={handleAddBac}
      />

      <CreateZoneModal
        visible={isAddingZone}
        onClose={() => setIsAddingZone(false)}
        onSubmit={handleAddZone}
      />

      <CreateUnitModal
        zoneId={addUnitForZoneId}
        onClose={() => setAddUnitForZoneId(null)}
        onSubmit={handleAddUnit}
      />
    </ScrollView>
  );
}
