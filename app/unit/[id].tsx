import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { SafeAreaView } from 'react-native-safe-area-context';
import UnitIcon from '../../src/components/UnitIcon';

export default function StorageUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { zones, storageUnits, shelves, bacs } = useStore();

  const unit = storageUnits.find((u) => u.id === id);
  const zone = zones.find((z) => z.id === unit?.zoneId);
  const unitShelves = shelves.filter((s) => s.unitId === id).sort((a, b) => a.level - b.level);

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
              <UnitIcon type={unit.type} size={18} />
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
                        key={bac.id} onPress={() => router.push(`/container/${bac.id}` as any)}
                        className="flex-1 rounded-xl items-center justify-center gap-2 bg-white/5 border border-white/10"
                        style={{ height: 120 }}
                      >
                        <Text className="text-[8px] font-black text-white uppercase" numberOfLines={1}>{bac.name}</Text>
                      </Pressable>
                    ))}
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
              <View className="py-12 items-center gap-2">
                <Text className="text-[10px] font-bold text-white/60 uppercase tracking-widest">Aucun niveau configuré</Text>
                <Text className="text-[9px] font-medium text-white/40 uppercase tracking-widest">Configurez via Paramètres → Structure</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
