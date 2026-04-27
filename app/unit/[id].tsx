import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Layers, Camera, Plus, ChevronRight, X } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContainerType } from '../../src/types';

const BAC_COLORS = ['#10B981', '#3B82F6', '#84CC16', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280'];
const BAC_ICONS = ['🍗', '🐟', '🥬', '🧀', '🍖', '🥩', '🥕', '🍞', '🥫', '🍅', '🥛', '🥚'];
const BAC_TYPES: { key: ContainerType; label: string }[] = [
  { key: 'bac', label: 'Bac' },
  { key: 'boite', label: 'Boîte' },
  { key: 'tiroir', label: 'Tiroir' },
  { key: 'etagere', label: 'Étagère' },
  { key: 'autre', label: 'Autre' },
];

export default function StorageUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { zones, storageUnits, shelves, bacs, setUnitShelves, addBac } = useStore();

  const unit = storageUnits.find((u) => u.id === id);
  const zone = zones.find((z) => z.id === unit?.zoneId);
  const unitShelves = shelves.filter((s) => s.unitId === id).sort((a, b) => a.level - b.level);

  const [isEditingStructure, setIsEditingStructure] = useState(false);
  const [shelfCount, setShelfCount] = useState(unitShelves.length);
  const [addBacShelfId, setAddBacShelfId] = useState<string | null>(null);

  if (!unit) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Unité non trouvée</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4 flex-1">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
          <View className="flex-row items-center gap-3 flex-1">
            <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
              <Text className="text-xl">{unit.icon}</Text>
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-1">
                <Text className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{zone?.name}</Text>
                <ChevronRight size={8} color="#9CA3AF" />
                <Text className="text-[8px] font-bold text-primary uppercase tracking-widest">{unit.name}</Text>
              </View>
              <Text className="text-sm font-black text-gray-900 uppercase">{unit.name}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row gap-2">
          <Pressable onPress={() => setIsEditingStructure(true)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <Layers size={20} color="#9CA3AF" />
          </Pressable>
          <Pressable testID="open-camera" onPress={() => router.push(`/camera?unitId=${id}` as any)} className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
            <Camera size={20} color="#10B981" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }}>
        <View className="gap-4">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vue Spatiale</Text>

          <View className="bg-gray-900 rounded-3xl p-6 gap-6" style={{ minHeight: 400 }}>
            {unitShelves.map((shelf) => {
              const shelfBacs = bacs.filter((b) => b.shelfId === shelf.id);
              return (
                <View key={shelf.id} className="gap-3">
                  <View className="bg-gray-800/30 rounded-2xl p-4 border border-white/5 flex-row gap-2 items-end" style={{ minHeight: 140 }}>
                    {shelfBacs.map((bac) => (
                      <Pressable
                        key={bac.id} onPress={() => router.push(`/bac/${bac.id}` as any)}
                        className="flex-1 rounded-xl items-center justify-center gap-2"
                        style={{ height: 120, backgroundColor: `${bac.color}25`, borderWidth: 2, borderColor: `${bac.color}50` }}
                      >
                        <Text className="text-3xl">{bac.icon}</Text>
                        <Text className="text-[8px] font-black text-white uppercase" numberOfLines={1}>{bac.name}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      onPress={() => setAddBacShelfId(shelf.id)}
                      className="flex-1 h-32 border-2 border-dashed border-white/10 rounded-xl items-center justify-center gap-2"
                    >
                      <View className="w-8 h-8 rounded-full bg-white/5 items-center justify-center">
                        <Plus size={14} color="rgba(255,255,255,0.5)" />
                      </View>
                      <Text className="text-[7px] font-bold uppercase tracking-widest text-white/40">Ajouter</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row justify-between items-center px-2">
                    <View className="flex-row items-center gap-2">
                      <View className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <Text className="text-[9px] font-black text-white/50 uppercase tracking-widest">{shelf.name}</Text>
                    </View>
                    <Text className="text-[8px] font-bold text-primary/60 uppercase">Niveau {shelf.level}</Text>
                  </View>
                </View>
              );
            })}
            {unitShelves.length === 0 && (
              <Pressable onPress={() => setIsEditingStructure(true)} className="py-12 items-center gap-2">
                <View className="w-12 h-12 rounded-xl bg-white/5 items-center justify-center">
                  <Layers size={20} color="rgba(255,255,255,0.5)" />
                </View>
                <Text className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Configurer les niveaux</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Détails des niveaux</Text>
          <View className="gap-3">
            {unitShelves.map((shelf) => (
              <View key={shelf.id} className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
                <View className="flex-row justify-between items-center">
                  <View className="flex-row items-center gap-2">
                    <Layers size={14} color="#10B981" />
                    <Text className="text-xs font-black text-gray-900 uppercase">{shelf.name}</Text>
                  </View>
                  <Pressable onPress={() => setAddBacShelfId(shelf.id)} className="flex-row items-center gap-1 bg-primary/10 px-2.5 py-1 rounded-lg">
                    <Plus size={10} color="#10B981" />
                    <Text className="text-[9px] font-black text-primary uppercase">Support</Text>
                  </Pressable>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  {bacs.filter((b) => b.shelfId === shelf.id).map((bac) => (
                    <View key={bac.id} className="flex-row items-center gap-2 p-2 bg-gray-50 rounded-xl">
                      <Text className="text-sm">{bac.icon}</Text>
                      <Text className="text-[10px] font-bold text-gray-700">{bac.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Modal visible={isEditingStructure} transparent animationType="slide" onRequestClose={() => setIsEditingStructure(false)}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-3xl p-8 gap-6">
            <View className="flex-row justify-between items-start">
              <View>
                <Text className="text-xl font-black uppercase text-gray-900">Structure</Text>
                <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Configurer les niveaux</Text>
              </View>
              <Pressable onPress={() => setIsEditingStructure(false)} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
                <X size={20} color="#9CA3AF" />
              </Pressable>
            </View>

            <View className="gap-4">
              <View className="flex-row justify-between items-center">
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Niveaux: {shelfCount}</Text>
              </View>
              <View className="flex-row items-center justify-center gap-4">
                <Pressable onPress={() => shelfCount > 1 && setShelfCount(shelfCount - 1)} className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center">
                  <Text className="text-xl font-bold">-</Text>
                </Pressable>
                <Text className="text-4xl font-black text-primary w-16 text-center">{shelfCount}</Text>
                <Pressable onPress={() => shelfCount < 10 && setShelfCount(shelfCount + 1)} className="w-12 h-12 rounded-xl bg-gray-100 items-center justify-center">
                  <Text className="text-xl font-bold">+</Text>
                </Pressable>
              </View>
              <View className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                <Text className="text-[10px] font-bold text-primary">
                  L'ajustement créera ou supprimera automatiquement les étagères.
                </Text>
              </View>
              <Pressable
                onPress={() => { setUnitShelves(unit.id, shelfCount); setIsEditingStructure(false); }}
                className="bg-primary py-4 rounded-2xl"
              >
                <Text className="text-white font-black uppercase text-xs text-center">Appliquer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <CreateBacModal
        shelfId={addBacShelfId}
        onClose={() => setAddBacShelfId(null)}
        onSubmit={(shelfId, name, type, color, icon) => {
          addBac({ shelfId, name, type, color, icon });
          setAddBacShelfId(null);
        }}
      />
    </SafeAreaView>
  );
}

function CreateBacModal({ shelfId, onClose, onSubmit }: { shelfId: string | null; onClose: () => void; onSubmit: (shelfId: string, name: string, type: ContainerType, color: string, icon: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContainerType>('bac');
  const [color, setColor] = useState(BAC_COLORS[0]);
  const [icon, setIcon] = useState(BAC_ICONS[0]);

  const reset = () => { setName(''); setType('bac'); setColor(BAC_COLORS[0]); setIcon(BAC_ICONS[0]); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!shelfId || !name.trim()) return;
    onSubmit(shelfId, name.trim(), type, color, icon);
    reset();
  };

  return (
    <Modal visible={!!shelfId} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <ScrollView className="bg-white rounded-t-3xl" contentContainerStyle={{ padding: 32, gap: 24 }}>
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">Nouveau Contenant</Text>
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Bac, boîte, tiroir...</Text>
            </View>
            <Pressable onPress={handleClose} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex : Poulet"
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900"
            />
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {BAC_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setType(t.key)}
                  className={`px-3 py-2 rounded-xl ${type === t.key ? 'bg-primary' : 'bg-gray-50'}`}
                >
                  <Text className={`text-[10px] font-black uppercase ${type === t.key ? 'text-white' : 'text-gray-700'}`}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Couleur</Text>
            <View className="flex-row flex-wrap gap-2">
              {BAC_COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  className={`w-10 h-10 rounded-xl ${color === c ? 'border-2 border-gray-900' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Icône</Text>
            <View className="flex-row flex-wrap gap-2">
              {BAC_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  className={`w-12 h-12 rounded-xl items-center justify-center ${icon === ic ? 'bg-primary/10 border border-primary' : 'bg-gray-50'}`}
                >
                  <Text className="text-2xl">{ic}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!name.trim()}
            className={`py-4 rounded-2xl ${name.trim() ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <Text className={`font-black uppercase text-xs text-center ${name.trim() ? 'text-white' : 'text-gray-400'}`}>Créer le contenant</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
