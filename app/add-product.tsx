import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Calendar, Package, Flame, PackageOpen, Snowflake, Truck, Eye, MapPin, ChevronRight, X } from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import { ActionType } from '../src/types';
import { addDays, startOfDay } from 'date-fns';
import ProductLabel from '../src/components/ProductLabel';
import { SafeAreaView } from 'react-native-safe-area-context';

const SUGGESTIONS = ['Poulet blanc', 'Escalope', 'Poulet rôti', 'Aiguillettes', 'Cuisse de poulet'];
const UNITS = ['kg', 'g', 'pce', 'L', 'broche', 'bacs'];

export default function AddProductScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bacId?: string; editMode?: string; productId?: string }>();
  const { zones, storageUnits, shelves, bacs, addProduct, updateProduct, products, user } = useStore();

  const editMode = params.editMode === 'true';
  const existingProduct = params.productId ? products.find((p) => p.id === params.productId) : null;

  const [bacId, setBacId] = useState(params.bacId || existingProduct?.bacId || bacs[0]?.id || '');
  const [isSelectingBac, setIsSelectingBac] = useState(false);
  const [selectionPath, setSelectionPath] = useState<{ zoneId?: string; unitId?: string; shelfId?: string }>({});

  const [name, setName] = useState(existingProduct?.name || '');
  const [quantity, setQuantity] = useState(existingProduct?.quantity.toString() || '');
  const [unit, setUnit] = useState(existingProduct?.unit || 'kg');
  const [dlc, setDlc] = useState<number>(existingProduct?.dlc || addDays(startOfDay(new Date()), 3).getTime());
  const [actionType, setActionType] = useState<ActionType>(existingProduct?.actionType || 'received');
  const [batchNumber, setBatchNumber] = useState(existingProduct?.batchNumber || '');
  const [temperature, setTemperature] = useState(existingProduct?.temperature?.toString() || '');
  const [origin, setOrigin] = useState(existingProduct?.origin || '');
  const [showPreview, setShowPreview] = useState(false);

  const handleActionTypeChange = (type: ActionType) => {
    setActionType(type);
    let days = 3;
    if (type === 'cooked') days = 3;
    if (type === 'opened') days = 2;
    if (type === 'received') days = 5;
    if (type === 'defrosted') days = 1;
    setDlc(addDays(startOfDay(new Date()), days).getTime());
  };

  const handleSubmit = () => {
    if (!name || !quantity || !bacId) return;
    const productData = {
      bacId, name,
      quantity: parseFloat(quantity), unit, dlc, actionType,
      batchNumber: batchNumber || undefined,
      temperature: temperature ? parseFloat(temperature) : undefined,
      origin: origin || undefined,
      preparerName: user?.name,
    };
    if (editMode && params.productId) updateProduct(params.productId, productData);
    else addProduct(productData);
    router.back();
  };

  const selectedBac = bacs.find((b) => b.id === bacId);
  const selectedShelf = shelves.find((s) => s.id === selectedBac?.shelfId);
  const selectedUnit = storageUnits.find((u) => u.id === selectedShelf?.unitId);
  const selectedZone = zones.find((z) => z.id === selectedUnit?.zoneId);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">{editMode ? 'Modifier' : 'Nouveau produit'}</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Étiquetage rapide</Text>
          </View>
        </View>
        <Pressable onPress={() => setShowPreview(!showPreview)} className={cn('w-10 h-10 rounded-xl items-center justify-center', showPreview ? 'bg-primary' : 'bg-gray-50')}>
          <Eye size={20} color={showPreview ? '#fff' : '#9CA3AF'} />
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        {showPreview && (
          <View className="bg-gray-50 border-b border-gray-100 p-6">
            <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Aperçu</Text>
            <ProductLabel
              product={{
                id: 'preview', bacId, name: name || 'Nom du produit',
                quantity: parseFloat(quantity) || 0, unit,
                addedAt: Date.now(), dlc, status: 'active', actionType,
                batchNumber, temperature: temperature ? parseFloat(temperature) : undefined, origin,
                preparerName: user?.name || 'Chef', modifiedAt: Date.now(), syncStatus: 'synced',
              }}
              size="sm"
            />
          </View>
        )}

        <View className="p-6 gap-8">
          <View className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Emplacement</Text>
              <Pressable onPress={() => setIsSelectingBac(true)} className="flex-row items-center gap-1">
                <MapPin size={10} color="#10B981" />
                <Text className="text-[9px] font-black text-primary uppercase tracking-widest">Changer</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setIsSelectingBac(true)} className="bg-white border-2 border-gray-100 p-4 rounded-2xl flex-row items-center gap-4">
              <View className="w-12 h-12 rounded-xl bg-gray-50 items-center justify-center">
                <Text className="text-2xl">{selectedBac?.icon || '📦'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase">{selectedBac?.name || 'Sélectionner'}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                  {selectedZone?.name} • {selectedUnit?.name} • {selectedShelf?.name}
                </Text>
              </View>
              <ChevronRight size={16} color="#D1D5DB" />
            </Pressable>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {bacs.slice(0, 5).map((bac) => (
                <Pressable
                  key={bac.id} onPress={() => setBacId(bac.id)}
                  className={cn('px-3 py-2 rounded-xl border-2', bacId === bac.id ? 'bg-primary/5 border-primary' : 'bg-white border-gray-100')}
                >
                  <Text className={cn('text-[8px] font-black uppercase tracking-widest', bacId === bac.id ? 'text-primary' : 'text-gray-400')}>{bac.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type d'action</Text>
            <View className="flex-row gap-2">
              {[
                { id: 'received' as ActionType, label: 'Reçu', icon: Truck },
                { id: 'cooked' as ActionType, label: 'Cuit', icon: Flame },
                { id: 'opened' as ActionType, label: 'Ouvert', icon: PackageOpen },
                { id: 'defrosted' as ActionType, label: 'Décong.', icon: Snowflake },
              ].map((type) => {
                const Icon = type.icon;
                const active = actionType === type.id;
                return (
                  <Pressable key={type.id} onPress={() => handleActionTypeChange(type.id)} className={cn('flex-1 py-3 rounded-xl border-2 items-center gap-1', active ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}>
                    <Icon size={16} color={active ? '#10B981' : '#9CA3AF'} />
                    <Text className={cn('text-[8px] font-bold uppercase', active ? 'text-primary' : 'text-gray-400')}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom du produit</Text>
            <View className="relative">
              <TextInput
                value={name} onChangeText={setName} placeholder="Ex: Poulet blanc"
                className="bg-white border border-gray-100 p-4 pl-12 rounded-2xl font-bold text-gray-900"
              />
              <View className="absolute left-4 top-4"><Package size={20} color="#D1D5DB" /></View>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} onPress={() => setName(s)} className={cn('px-3 py-1.5 rounded-lg', name === s ? 'bg-primary' : 'bg-gray-100')}>
                  <Text className={cn('text-[10px] font-bold uppercase', name === s ? 'text-white' : 'text-gray-500')}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row gap-4">
            <View className="flex-1 gap-3">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantité</Text>
              <TextInput value={quantity} onChangeText={setQuantity} placeholder="0.0" keyboardType="decimal-pad" className="bg-white border border-gray-100 p-4 rounded-2xl font-bold text-gray-900" />
            </View>
            <View className="flex-1 gap-3">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Unité</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {UNITS.map((u) => (
                  <Pressable key={u} onPress={() => setUnit(u)} className={cn('px-4 py-4 rounded-2xl border', unit === u ? 'bg-primary border-primary' : 'bg-white border-gray-100')}>
                    <Text className={cn('font-bold text-xs', unit === u ? 'text-white' : 'text-gray-900')}>{u}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">DLC</Text>
            <View className="flex-row gap-2">
              {[0, 1, 2, 3, 5].map((days) => {
                const date = addDays(startOfDay(new Date()), days);
                const isActive = startOfDay(new Date(dlc)).getTime() === date.getTime();
                return (
                  <Pressable key={days} onPress={() => setDlc(date.getTime())} className={cn('flex-1 py-3 rounded-xl border-2 items-center', isActive ? 'border-primary bg-primary/5' : 'border-gray-100 bg-white')}>
                    <Text className={cn('text-[10px] font-black uppercase', isActive ? 'text-primary' : 'text-gray-400')}>{days === 0 ? 'Auj.' : `+${days}j`}</Text>
                    <Text className={cn('text-[8px] font-bold', isActive ? 'text-primary' : 'text-gray-400')}>{date.getDate()}/{date.getMonth() + 1}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {!user?.settings?.simplifiedMode && (
            <View className="gap-4 pt-4 border-t border-gray-50">
              <Text className="text-[10px] font-black text-primary uppercase tracking-widest">Détails HACCP</Text>
              <View className="flex-row gap-4">
                <View className="flex-1 gap-2">
                  <Text className="text-[9px] font-bold text-gray-400 uppercase">N° de lot</Text>
                  <TextInput value={batchNumber} onChangeText={setBatchNumber} placeholder="L240408" className="bg-gray-50 p-3 rounded-xl text-xs font-bold" />
                </View>
                <View className="flex-1 gap-2">
                  <Text className="text-[9px] font-bold text-gray-400 uppercase">Temp.</Text>
                  <TextInput value={temperature} onChangeText={setTemperature} placeholder="3.5" keyboardType="decimal-pad" className="bg-gray-50 p-3 rounded-xl text-xs font-bold" />
                </View>
              </View>
              <View className="gap-2">
                <Text className="text-[9px] font-bold text-gray-400 uppercase">Origine</Text>
                <TextInput value={origin} onChangeText={setOrigin} placeholder="Metro, Boucher..." className="bg-gray-50 p-3 rounded-xl text-xs font-bold" />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="p-6 bg-white border-t border-gray-100 flex-row gap-4">
        <Pressable onPress={() => router.back()} className="flex-1 bg-gray-50 py-4 rounded-2xl">
          <Text className="text-gray-400 font-bold uppercase text-xs text-center">Annuler</Text>
        </Pressable>
        <Pressable onPress={handleSubmit} className="flex-[2] bg-primary py-4 rounded-2xl flex-row items-center justify-center gap-2">
          <Check size={20} color="#fff" />
          <Text className="text-white font-bold">{editMode ? 'ENREGISTRER' : 'AJOUTER'}</Text>
        </Pressable>
      </View>

      <Modal visible={isSelectingBac} transparent animationType="slide" onRequestClose={() => setIsSelectingBac(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-8 gap-6" style={{ maxHeight: '90%' }}>
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-xl font-black uppercase text-gray-900">Emplacement</Text>
                <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Où placer ?</Text>
              </View>
              <Pressable onPress={() => setIsSelectingBac(false)} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {!selectionPath.zoneId && zones.map((zone) => (
                <Pressable key={zone.id} onPress={() => setSelectionPath({ zoneId: zone.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Text className="text-2xl">{zone.icon}</Text>
                    <Text className="text-sm font-black text-gray-900 uppercase">{zone.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.zoneId && !selectionPath.unitId && storageUnits.filter((u) => u.zoneId === selectionPath.zoneId).map((u) => (
                <Pressable key={u.id} onPress={() => setSelectionPath({ ...selectionPath, unitId: u.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <Text className="text-2xl">{u.icon}</Text>
                    <Text className="text-sm font-black text-gray-900 uppercase">{u.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.unitId && !selectionPath.shelfId && shelves.filter((s) => s.unitId === selectionPath.unitId).map((s) => (
                <Pressable key={s.id} onPress={() => setSelectionPath({ ...selectionPath, shelfId: s.id })} className="bg-gray-50 p-4 rounded-2xl flex-row items-center justify-between">
                  <View className="flex-row items-center gap-4">
                    <View className="w-8 h-8 rounded-lg bg-primary/10 items-center justify-center">
                      <Text className="text-primary font-black text-xs">{s.level}</Text>
                    </View>
                    <Text className="text-sm font-black text-gray-900 uppercase">{s.name}</Text>
                  </View>
                  <ChevronRight size={16} color="#D1D5DB" />
                </Pressable>
              ))}

              {selectionPath.shelfId && bacs.filter((b) => b.shelfId === selectionPath.shelfId).map((bac) => (
                <Pressable
                  key={bac.id}
                  onPress={() => { setBacId(bac.id); setIsSelectingBac(false); setSelectionPath({}); }}
                  className={cn('p-4 rounded-2xl flex-row items-center justify-between border-2', bacId === bac.id ? 'bg-primary/5 border-primary' : 'bg-gray-50 border-transparent')}
                >
                  <View className="flex-row items-center gap-4">
                    <Text className="text-2xl">{bac.icon}</Text>
                    <Text className={cn('text-sm font-black uppercase', bacId === bac.id ? 'text-primary' : 'text-gray-900')}>{bac.name}</Text>
                  </View>
                  {bacId === bac.id && <Check size={16} color="#10B981" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
