import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Check, MapPin, Layers, LayoutGrid, Plus, Clock, Search, FileText, Edit2 } from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import { addDays, startOfDay } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ExpressAddScreen() {
  const router = useRouter();
  const { zones, storageUnits, shelves, bacs, addProduct, user } = useStore();

  const [step, setStep] = useState<'zone' | 'unit' | 'shelf' | 'bac'>('zone');
  const [selection, setSelection] = useState<{ zoneId?: string; unitId?: string; shelfId?: string }>({});
  const [successProduct, setSuccessProduct] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);

  const handleZoneSelect = (zoneId: string) => {
    const zoneUnits = storageUnits.filter((u) => u.zoneId === zoneId);
    if (zoneUnits.length === 1) {
      const unitId = zoneUnits[0].id;
      const unitShelves = shelves.filter((s) => s.unitId === unitId);
      if (unitShelves.length === 1) {
        setSelection({ zoneId, unitId, shelfId: unitShelves[0].id });
        setStep('bac');
      } else {
        setSelection({ zoneId, unitId });
        setStep('shelf');
      }
    } else {
      setSelection({ zoneId });
      setStep('unit');
    }
  };

  const handleUnitSelect = (unitId: string) => {
    const unitShelves = shelves.filter((s) => s.unitId === unitId);
    if (unitShelves.length === 1) {
      setSelection((prev) => ({ ...prev, unitId, shelfId: unitShelves[0].id }));
      setStep('bac');
    } else {
      setSelection((prev) => ({ ...prev, unitId }));
      setStep('shelf');
    }
  };

  const handleShelfSelect = (shelfId: string) => {
    setSelection((prev) => ({ ...prev, shelfId }));
    setStep('bac');
  };

  const handleBacSelect = (bacId: string) => {
    const bac = bacs.find((b) => b.id === bacId);
    if (!bac) return;
    const newId = addProduct({
      bacId, name: bac.name, quantity: 1, unit: 'pce',
      dlc: addDays(startOfDay(new Date()), 3).getTime(),
      actionType: 'received',
      preparerName: user?.name,
      batchNumber: batchNumber || undefined,
    });
    setSuccessProduct(newId);
    if (isBatchMode) setTimeout(() => setSuccessProduct(null), 1500);
  };

  const filteredBacs = bacs.filter((b) => b.shelfId === selection.shelfId);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Étiquetage Express</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">3 taps</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-1">
          {(['zone', 'unit', 'shelf', 'bac'] as const).map((s) => (
            <View key={s} className={cn('w-1.5 h-1.5 rounded-full', step === s ? 'bg-primary' : 'bg-gray-200')} />
          ))}
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24 }}>
        <View className="bg-gray-900 rounded-2xl p-4 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-8 h-8 rounded-lg bg-white/10 items-center justify-center">
              <FileText size={16} color="#10B981" />
            </View>
            <TextInput
              placeholder="N° de Lot" placeholderTextColor="rgba(255,255,255,0.2)"
              value={batchNumber} onChangeText={setBatchNumber}
              className="flex-1 text-white text-[10px] font-bold uppercase tracking-widest"
            />
          </View>
          <Pressable onPress={() => setIsBatchMode(!isBatchMode)} className={cn('px-3 py-1.5 rounded-lg', isBatchMode ? 'bg-primary' : 'bg-white/5')}>
            <Text className={cn('text-[8px] font-black uppercase tracking-widest', isBatchMode ? 'text-white' : 'text-white/40')}>
              Rafale: {isBatchMode ? 'ON' : 'OFF'}
            </Text>
          </Pressable>
        </View>

        {step === 'zone' && (
          <>
            <View className="relative">
              <View className="absolute left-4 top-5 z-10"><Search size={18} color="#9CA3AF" /></View>
              <TextInput
                placeholder="Rechercher un bac..." value={searchQuery} onChangeText={setSearchQuery}
                className="pl-12 pr-4 py-4 bg-white rounded-2xl border border-gray-100 text-sm font-bold"
              />
            </View>

            {searchQuery ? (
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <Search size={14} color="#10B981" />
                  <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Résultats</Text>
                </View>
                <View className="flex-row flex-wrap -mx-1.5">
                  {bacs.filter((b) => b.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 6).map((bac) => {
                    const shelf = shelves.find((s) => s.id === bac.shelfId);
                    const unit = storageUnits.find((u) => u.id === shelf?.unitId);
                    const zone = zones.find((z) => z.id === unit?.zoneId);
                    return (
                      <View key={bac.id} className="w-1/2 p-1.5">
                        <Pressable onPress={() => handleBacSelect(bac.id)} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-3">
                          <Text className="text-2xl">{bac.icon}</Text>
                          <View className="flex-1">
                            <Text className="text-[10px] font-black text-gray-900 uppercase" numberOfLines={1}>{bac.name}</Text>
                            <Text className="text-[7px] font-bold text-gray-400 uppercase" numberOfLines={1}>{zone?.name} &gt; {unit?.name}</Text>
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : (
              <>
                <View>
                  <Text className="text-xl font-black uppercase text-gray-900">1. Zone</Text>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Où travaillez-vous ?</Text>
                </View>
                {zones.length > 0 ? zones.map((zone) => (
                  <Pressable key={zone.id} onPress={() => handleZoneSelect(zone.id)} className="bg-white p-5 rounded-3xl border border-gray-100 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-4">
                      <View className="w-14 h-14 rounded-2xl bg-gray-50 items-center justify-center">
                        <Text className="text-3xl">{zone.icon}</Text>
                      </View>
                      <View>
                        <Text className="text-sm font-black text-gray-900 uppercase">{zone.name}</Text>
                        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                          {storageUnits.filter((u) => u.zoneId === zone.id).length} Unités
                        </Text>
                      </View>
                    </View>
                    <ChevronRight size={20} color="#D1D5DB" />
                  </Pressable>
                )) : (
                  <View className="py-12 items-center gap-6">
                    <View className="w-20 h-20 rounded-full bg-gray-50 items-center justify-center">
                      <MapPin size={40} color="#D1D5DB" />
                    </View>
                    <Text className="text-sm font-black text-gray-900 uppercase">Aucune zone</Text>
                    <Pressable onPress={() => router.push('/settings')} className="px-8 py-4 bg-primary rounded-2xl">
                      <Text className="text-white text-[10px] font-black uppercase tracking-widest">Configurer</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {step === 'unit' && (
          <>
            <View className="flex-row items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <Pressable onPress={() => setStep('zone')} className="px-2 py-1">
                <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{zones.find((z) => z.id === selection.zoneId)?.name}</Text>
              </Pressable>
              <ChevronRight size={10} color="#D1D5DB" />
              <View className="px-2 py-1 bg-white rounded-lg">
                <Text className="text-[9px] font-black text-primary uppercase tracking-widest">Unité</Text>
              </View>
            </View>
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">2. Unité</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Frigo, Réserve...</Text>
            </View>
            {storageUnits.filter((u) => u.zoneId === selection.zoneId).map((unit) => (
              <Pressable key={unit.id} onPress={() => handleUnitSelect(unit.id)} className="bg-white p-5 rounded-3xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-2xl bg-gray-50 items-center justify-center">
                    <Text className="text-3xl">{unit.icon}</Text>
                  </View>
                  <View>
                    <Text className="text-sm font-black text-gray-900 uppercase">{unit.name}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      {shelves.filter((s) => s.unitId === unit.id).length} Niveaux
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#D1D5DB" />
              </Pressable>
            ))}
          </>
        )}

        {step === 'shelf' && (
          <>
            <View className="flex-row items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <Pressable onPress={() => setStep('zone')} className="px-2 py-1">
                <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{zones.find((z) => z.id === selection.zoneId)?.name}</Text>
              </Pressable>
              <ChevronRight size={10} color="#D1D5DB" />
              <Pressable onPress={() => setStep('unit')} className="px-2 py-1 bg-white rounded-lg">
                <Text className="text-[9px] font-black text-primary uppercase tracking-widest">{storageUnits.find((u) => u.id === selection.unitId)?.name}</Text>
              </Pressable>
            </View>
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">3. Étagère</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quel niveau ?</Text>
            </View>
            {shelves.filter((s) => s.unitId === selection.unitId).sort((a, b) => a.level - b.level).map((shelf) => (
              <Pressable key={shelf.id} onPress={() => handleShelfSelect(shelf.id)} className="bg-white p-5 rounded-3xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-4">
                  <View className="w-14 h-14 rounded-2xl bg-primary/5 items-center justify-center">
                    <Layers size={24} color="#10B981" />
                  </View>
                  <View>
                    <Text className="text-sm font-black text-gray-900 uppercase">{shelf.name}</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Niveau {shelf.level}</Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#D1D5DB" />
              </Pressable>
            ))}
          </>
        )}

        {step === 'bac' && (
          <>
            <View className="flex-row items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
              <Pressable onPress={() => setStep('zone')} className="px-2 py-1"><Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{zones.find((z) => z.id === selection.zoneId)?.name}</Text></Pressable>
              <ChevronRight size={10} color="#D1D5DB" />
              <Pressable onPress={() => setStep('unit')} className="px-2 py-1"><Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{storageUnits.find((u) => u.id === selection.unitId)?.name}</Text></Pressable>
              <ChevronRight size={10} color="#D1D5DB" />
              <Pressable onPress={() => setStep('shelf')} className="px-2 py-1 bg-white rounded-lg"><Text className="text-[9px] font-black text-primary uppercase tracking-widest">{shelves.find((s) => s.id === selection.shelfId)?.name}</Text></Pressable>
            </View>
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">4. Tap pour Étiqueter</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sélectionnez le support</Text>
            </View>
            {filteredBacs.length > 0 ? (
              <View className="flex-row flex-wrap -mx-1.5">
                {filteredBacs.map((bac) => (
                  <View key={bac.id} className="w-1/2 p-1.5">
                    <Pressable onPress={() => handleBacSelect(bac.id)} className="bg-white p-6 rounded-3xl border border-gray-100 items-center gap-3">
                      <Text className="text-4xl">{bac.icon}</Text>
                      <Text className="text-[10px] font-black text-gray-900 uppercase text-center">{bac.name}</Text>
                    </Pressable>
                  </View>
                ))}
                <View className="w-1/2 p-1.5">
                  <Pressable onPress={() => router.push('/add-product')} className="bg-gray-50 p-6 rounded-3xl border border-dashed border-gray-200 items-center gap-2">
                    <Plus size={24} color="#9CA3AF" />
                    <Text className="text-[8px] font-black text-gray-400 uppercase text-center">Autre produit</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="py-12 items-center gap-6">
                <View className="w-20 h-20 rounded-full bg-gray-50 items-center justify-center">
                  <LayoutGrid size={40} color="#D1D5DB" />
                </View>
                <Text className="text-sm font-black text-gray-900 uppercase">Aucun support</Text>
                <Pressable onPress={() => router.push('/settings')} className="px-8 py-4 bg-primary rounded-2xl">
                  <Text className="text-white text-[10px] font-black uppercase tracking-widest">Configurer</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={!!successProduct} transparent animationType="fade">
        <View className="flex-1 bg-primary items-center justify-center p-8">
          <View className="w-24 h-24 rounded-full bg-white/20 items-center justify-center mb-6">
            <Check size={48} color="#fff" />
          </View>
          <Text className="text-3xl font-black uppercase text-white text-center mb-2">Étiquette Créée !</Text>
          <Text className="text-white/70 text-sm font-bold uppercase tracking-widest mb-12">Enregistré</Text>
          <View className="w-full gap-3">
            <Pressable onPress={() => { setSuccessProduct(null); router.push('/'); }} className="bg-white py-5 rounded-2xl">
              <Text className="text-primary font-black uppercase text-xs text-center">Terminer</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const pid = successProduct;
                setSuccessProduct(null);
                if (pid) router.push({ pathname: '/add-product', params: { productId: pid, editMode: 'true' } });
              }}
              className="bg-white/10 py-5 rounded-2xl flex-row items-center justify-center gap-2"
            >
              <Edit2 size={16} color="#fff" />
              <Text className="text-white font-black uppercase text-xs">Modifier</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
