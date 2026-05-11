import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal, BackHandler, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Plus, Trash2, ChevronRight, X, Boxes, LogOut, Scale, Check, Edit2 } from 'lucide-react-native';
import { signOut } from '../../src/lib/firebase';
import { signOutGoogle } from '../../src/lib/googleSignIn';
import { useStore } from '../../src/lib/store';
import { cn } from '../../src/lib/utils';
import { ContainerType, StorageUnit, ZoneType } from '../../src/types';
import CreateZoneModal from '../../src/components/CreateZoneModal';
import CreateUnitModal from '../../src/components/CreateUnitModal';
import CreateBacModal from '../../src/components/CreateBacModal';
import UnitIcon from '../../src/components/UnitIcon';
import ZoneIcon from '../../src/components/ZoneIcon';
import SyncRow from '../../src/components/SyncRow';

export default function SettingsScreen() {
  const {
    zones, storageUnits, shelves, bacs,
    addZone, deleteZone,
    addStorageUnit, deleteStorageUnit,
    addShelf, deleteShelf, setUnitShelves,
    addBac, deleteBac,
    productUnits, addProductUnit, updateProductUnit, deleteProductUnit,
  } = useStore();

  const [section, setSection] = useState<'menu' | 'structure' | 'units'>('menu');
  const [drillDown, setDrillDown] = useState<{ zoneId?: string; unitId?: string }>({});
  const [newUnit, setNewUnit] = useState('');
  const [editingUnit, setEditingUnit] = useState<{ original: string; value: string } | null>(null);

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

  const menuItems: { id: 'structure' | 'units'; label: string; description: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
    { id: 'structure', label: 'Structure', description: 'Zones, unités, niveaux, contenants', icon: Boxes },
    { id: 'units', label: 'Unités', description: 'Unités de mesure pour les produits', icon: Scale },
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

  if (section === 'units') {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => setSection('menu')} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
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
