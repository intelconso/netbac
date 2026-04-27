import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Switch, Modal } from 'react-native';
import { Plus, Trash2, ChevronRight, X, Layers } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { cn } from '../../src/lib/utils';
import { ContainerType } from '../../src/types';

export default function SettingsScreen() {
  const {
    zones, storageUnits, shelves, bacs, user,
    addZone, deleteZone,
    addStorageUnit, deleteStorageUnit,
    addShelf, deleteShelf, setUnitShelves,
    addBac, deleteBac,
    updateSettings,
  } = useStore();

  const [activeTab, setActiveTab] = useState<'structure' | 'quick' | 'prefs'>('structure');
  const [quickTab, setQuickTab] = useState<'zones' | 'units' | 'shelves' | 'bacs'>('zones');
  const [drillDown, setDrillDown] = useState<{ zoneId?: string; unitId?: string }>({});

  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');

  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState<'frigo' | 'congelateur' | 'reserve' | 'saladette' | 'autre'>('frigo');

  const [isAddingShelf, setIsAddingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');

  const [isAddingBac, setIsAddingBac] = useState(false);
  const [newBacName, setNewBacName] = useState('');
  const [newBacType, setNewBacType] = useState<ContainerType>('bac');
  const [newBacShelfId, setNewBacShelfId] = useState(shelves[0]?.id || '');

  const handleAddZone = () => {
    if (!newZoneName) return;
    addZone({ name: newZoneName, icon: '📍' });
    setNewZoneName(''); setIsAddingZone(false);
  };

  const handleAddUnit = () => {
    const zoneId = drillDown.zoneId || zones[0]?.id;
    if (!newUnitName || !zoneId) return;
    addStorageUnit({
      name: newUnitName, zoneId, type: newUnitType,
      icon: newUnitType === 'frigo' ? '❄️' : newUnitType === 'congelateur' ? '🧊' : newUnitType === 'saladette' ? '🥗' : '🥫',
    });
    setNewUnitName(''); setIsAddingUnit(false);
  };

  const handleAddShelf = () => {
    const unitId = drillDown.unitId || storageUnits[0]?.id;
    if (!newShelfName || !unitId) return;
    const level = shelves.filter((s) => s.unitId === unitId).length + 1;
    addShelf({ name: newShelfName, unitId, level });
    setNewShelfName(''); setIsAddingShelf(false);
  };

  const handleAddBac = () => {
    if (!newBacName || !newBacShelfId) return;
    addBac({
      name: newBacName, shelfId: newBacShelfId, type: newBacType,
      color: '#10B981',
      icon: newBacType === 'bac' ? '🍗' : newBacType === 'boite' ? '📦' : '📥',
    });
    setNewBacName(''); setIsAddingBac(false);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
      <View className="mb-6">
        <Text className="text-sm font-black text-gray-900 uppercase">Administration</Text>
        <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Configuration du restaurant</Text>
      </View>

      <View className="flex-row p-1 bg-gray-100 rounded-xl mb-6">
        {[
          { id: 'structure', label: 'Structure' },
          { id: 'quick', label: 'Vue Rapide' },
          { id: 'prefs', label: 'Préférences' },
        ].map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id as any)}
            className={cn('flex-1 px-4 py-2 rounded-lg', activeTab === tab.id ? 'bg-white' : '')}
          >
            <Text className={cn('text-[9px] font-black uppercase text-center', activeTab === tab.id ? 'text-primary' : 'text-gray-400')}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {activeTab === 'structure' && (
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
              {isAddingZone && (
                <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-3">
                  <TextInput
                    autoFocus placeholder="Nom (ex: Cuisine, Réserve...)" value={newZoneName} onChangeText={setNewZoneName}
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setIsAddingZone(false)} className="flex-1 py-2"><Text className="text-[10px] font-bold text-gray-400 uppercase text-center">Annuler</Text></Pressable>
                    <Pressable onPress={handleAddZone} className="flex-1 py-2 bg-primary rounded-lg"><Text className="text-[10px] font-bold uppercase text-center text-white">Confirmer</Text></Pressable>
                  </View>
                </View>
              )}
              {zones.map((zone) => (
                <Pressable key={zone.id} onPress={() => setDrillDown({ zoneId: zone.id })} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-xl bg-gray-50 items-center justify-center">
                      <Text className="text-2xl">{zone.icon}</Text>
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
                <Pressable onPress={() => setIsAddingUnit(true)} className="flex-row items-center gap-1">
                  <Plus size={12} color="#10B981" />
                  <Text className="text-[10px] font-bold text-primary uppercase">Nouvelle Unité</Text>
                </Pressable>
              </View>
              {isAddingUnit && (
                <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-3">
                  <TextInput
                    autoFocus placeholder="Nom" value={newUnitName} onChangeText={setNewUnitName}
                    className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                  />
                  <View className="flex-row gap-2 flex-wrap">
                    {(['frigo', 'congelateur', 'saladette', 'reserve'] as const).map((t) => (
                      <Pressable key={t} onPress={() => setNewUnitType(t)} className={cn('px-3 py-2 rounded-lg border-2', newUnitType === t ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-transparent')}>
                        <Text className={cn('text-[10px] font-bold uppercase', newUnitType === t ? 'text-primary' : 'text-gray-400')}>{t}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable onPress={() => setIsAddingUnit(false)} className="flex-1 py-2"><Text className="text-[10px] font-bold text-gray-400 uppercase text-center">Annuler</Text></Pressable>
                    <Pressable onPress={handleAddUnit} className="flex-1 py-2 bg-primary rounded-lg"><Text className="text-[10px] font-bold uppercase text-center text-white">Confirmer</Text></Pressable>
                  </View>
                </View>
              )}
              {storageUnits.filter((u) => u.zoneId === drillDown.zoneId).map((unit) => {
                const shelfCount = shelves.filter((s) => s.unitId === unit.id).length;
                return (
                  <Pressable key={unit.id} onPress={() => setDrillDown({ zoneId: drillDown.zoneId, unitId: unit.id })} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4 flex-1">
                      <View className="w-12 h-12 rounded-xl bg-gray-50 items-center justify-center">
                        <Text className="text-2xl">{unit.icon}</Text>
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
                        <Text className="text-sm">{bac.icon}</Text>
                        <Text className="text-[10px] font-bold text-gray-600 uppercase">{bac.name}</Text>
                        <Pressable onPress={() => deleteBac(bac.id)}><X size={12} color="#D1D5DB" /></Pressable>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => { setNewBacShelfId(shelf.id); setIsAddingBac(true); }}
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
      )}

      {activeTab === 'quick' && (
        <View className="gap-6">
          <View className="flex-row p-1 bg-gray-50 rounded-lg">
            {[
              { id: 'zones', label: 'Zones' },
              { id: 'units', label: 'Unités' },
              { id: 'shelves', label: 'Niveaux' },
              { id: 'bacs', label: 'Supports' },
            ].map((t) => (
              <Pressable key={t.id} onPress={() => setQuickTab(t.id as any)} className={cn('flex-1 py-1.5 rounded-md', quickTab === t.id ? 'bg-white' : '')}>
                <Text className={cn('text-[8px] font-black uppercase text-center', quickTab === t.id ? 'text-primary' : 'text-gray-400')}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {quickTab === 'zones' && (
            <View className="gap-2">
              {zones.map((z) => (
                <View key={z.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl">{z.icon}</Text>
                    <Text className="text-sm font-bold text-gray-900">{z.name}</Text>
                  </View>
                  <Pressable onPress={() => deleteZone(z.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                </View>
              ))}
            </View>
          )}
          {quickTab === 'units' && (
            <View className="gap-2">
              {storageUnits.map((u) => (
                <View key={u.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl">{u.icon}</Text>
                    <View>
                      <Text className="text-sm font-bold text-gray-900">{u.name}</Text>
                      <Text className="text-[9px] font-bold text-primary uppercase">{zones.find((z) => z.id === u.zoneId)?.name}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteStorageUnit(u.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                </View>
              ))}
            </View>
          )}
          {quickTab === 'shelves' && (
            <View className="gap-2">
              {shelves.map((s) => (
                <View key={s.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Layers size={16} color="#10B981" />
                    <View>
                      <Text className="text-sm font-bold text-gray-900">{s.name}</Text>
                      <Text className="text-[9px] font-bold text-primary uppercase">{storageUnits.find((u) => u.id === s.unitId)?.name}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteShelf(s.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                </View>
              ))}
            </View>
          )}
          {quickTab === 'bacs' && (
            <View className="gap-2">
              {bacs.map((b) => (
                <View key={b.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-xl">{b.icon}</Text>
                    <View>
                      <Text className="text-sm font-bold text-gray-900">{b.name}</Text>
                      <Text className="text-[9px] font-bold text-primary uppercase">{shelves.find((s) => s.id === b.shelfId)?.name}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => deleteBac(b.id)} className="p-2"><Trash2 size={16} color="#D1D5DB" /></Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {activeTab === 'prefs' && (
        <View className="gap-6">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Modules Actifs</Text>

          <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-gray-900">Relevés de Température</Text>
              <Text className="text-[10px] text-gray-400">Activer le module HACCP froid</Text>
            </View>
            <Switch value={user?.settings?.enableTemperature ?? false} onValueChange={(v) => updateSettings({ enableTemperature: v })} />
          </View>

          <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-gray-900">Plan de Nettoyage</Text>
              <Text className="text-[10px] text-gray-400">Suivi de l'hygiène des locaux</Text>
            </View>
            <Switch value={user?.settings?.enableCleaning ?? false} onValueChange={(v) => updateSettings({ enableCleaning: v })} />
          </View>

          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Expérience</Text>
          <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View>
              <Text className="text-sm font-bold text-gray-900">Mode Simplifié</Text>
              <Text className="text-[10px] text-gray-400">Masquer les champs avancés</Text>
            </View>
            <Switch value={user?.settings?.simplifiedMode ?? false} onValueChange={(v) => updateSettings({ simplifiedMode: v })} />
          </View>
        </View>
      )}

      <View className="bg-white p-6 rounded-3xl border border-gray-100 gap-4 mt-8">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profil Responsable</Text>
        <View className="flex-row items-center gap-4">
          <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center">
            <Text className="text-2xl text-primary">{user?.name?.[0] || 'C'}</Text>
          </View>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">{user?.name}</Text>
            <Text className="text-[10px] font-bold text-primary uppercase">{user?.restaurantName}</Text>
          </View>
        </View>
        <View className="gap-2">
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Signature</Text>
          <View className="h-20 bg-gray-50 rounded-xl border border-dashed border-gray-200 items-center justify-center">
            <Text className="text-[9px] font-bold text-gray-300 uppercase italic">Signature enregistrée</Text>
          </View>
        </View>
      </View>

      <Modal visible={isAddingBac} transparent animationType="slide" onRequestClose={() => setIsAddingBac(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-8 gap-6" style={{ maxWidth: 400 }}>
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">Nouveau Support</Text>
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Configuration du contenant</Text>
            </View>
            <View className="gap-2">
              <Text className="text-[9px] font-black text-gray-400 uppercase ml-1">Nom</Text>
              <TextInput autoFocus placeholder="ex: POULET, SAUCE..." value={newBacName} onChangeText={setNewBacName} className="p-4 bg-gray-50 rounded-2xl text-sm font-bold" />
            </View>
            <View className="gap-2">
              <Text className="text-[9px] font-black text-gray-400 uppercase ml-1">Type</Text>
              <View className="flex-row gap-2">
                {(['bac', 'boite', 'tiroir'] as const).map((t) => (
                  <Pressable key={t} onPress={() => setNewBacType(t)} className={cn('flex-1 py-3 rounded-xl border-2', newBacType === t ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-transparent')}>
                    <Text className={cn('text-[10px] font-black uppercase text-center', newBacType === t ? 'text-primary' : 'text-gray-400')}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View className="flex-row gap-3 pt-4">
              <Pressable onPress={() => setIsAddingBac(false)} className="flex-1 py-4"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
              <Pressable onPress={handleAddBac} className="flex-1 py-4 bg-primary rounded-2xl"><Text className="text-[10px] font-black uppercase text-center text-white">Créer</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
