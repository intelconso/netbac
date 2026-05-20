import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import UnitIcon from '../src/components/UnitIcon';
import ZoneIcon from '../src/components/ZoneIcon';
import { useActiveStore } from '../src/lib/useActive';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SpatialScreen() {
  const router = useRouter();
  const { zones, storageUnits, bacs, shelves } = useActiveStore();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
          <ArrowLeft size={20} color="#9CA3AF" />
        </Pressable>
        <View>
          <Text className="text-sm font-black text-gray-900 uppercase">Vue spatiale</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Inventaire par zone</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 24 }}>
        {zones.length === 0 ? (
          <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucune zone configurée</Text>
            <Pressable onPress={() => router.push('/(tabs)/settings' as any)} className="px-4 py-2 bg-primary/10 rounded-xl">
              <Text className="text-[10px] font-black text-primary uppercase">Configurer dans Paramètres</Text>
            </Pressable>
          </View>
        ) : (
          zones.map((zone) => {
            const zoneUnits = storageUnits.filter((u) => u.zoneId === zone.id);
            return (
              <View key={zone.id} className="gap-3">
                <View className="flex-row items-center gap-2">
                  <ZoneIcon type={zone.type} size={12} color="#9CA3AF" />
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{zone.name}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                  {zoneUnits.map((unit) => {
                    const unitBacs = bacs.filter((b) => {
                      const shelf = shelves.find((s) => s.id === b.shelfId);
                      return shelf?.unitId === unit.id;
                    });
                    return (
                      <Pressable
                        key={unit.id}
                        onPress={() => router.push(`/unit/${unit.id}` as any)}
                        className="bg-white p-4 rounded-2xl border border-gray-100 items-center gap-2"
                        style={{ minWidth: 120 }}
                      >
                        <View className="w-12 h-12 rounded-xl items-center justify-center bg-gray-50">
                          <UnitIcon type={unit.type} size={20} />
                        </View>
                        <View className="items-center gap-0.5">
                          <Text className="text-xs font-black text-gray-900 uppercase" numberOfLines={1}>{unit.name}</Text>
                          <Text className="text-[8px] font-bold text-primary uppercase">{unitBacs.length} supports</Text>
                          <Text className="text-[7px] font-medium text-gray-400 uppercase">{unit.type}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
