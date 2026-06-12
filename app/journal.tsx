import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, AlertCircle } from 'lucide-react-native';
import { cn } from '../src/lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';

// The HACCP controls (temperatures, cleaning, oil checks) moved to the
// Traçabilité tab — this screen keeps only the planning/calendar view.
export default function JournalScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
        <View>
          <Text className="text-sm font-black text-gray-900 uppercase">Journal de Bord</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Planning</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }}>
        <View className="bg-gray-900 rounded-3xl p-6 gap-6">
          <View>
            <Text className="text-xl font-black uppercase text-white">Vue Mensuelle</Text>
            <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Avril 2026</Text>
          </View>
          <View className="flex-row flex-wrap">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
              <View key={i} className="items-center justify-center" style={{ width: '14.28%' }}>
                <Text className="text-[8px] font-black text-white/20">{d}</Text>
              </View>
            ))}
            {Array.from({ length: 30 }).map((_, i) => {
              const isToday = i + 1 === 18;
              return (
                <View key={i} className="items-center justify-center p-1" style={{ width: '14.28%' }}>
                  <View className={cn('aspect-square w-full rounded-lg items-center justify-center border border-white/5', isToday ? 'bg-primary' : '')}>
                    <Text className={cn('text-[10px] font-black', isToday ? 'text-white' : 'text-white/40')}>{i + 1}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Événements</Text>
          <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-danger/10 items-center justify-center">
                <AlertCircle size={18} color="#EF4444" />
              </View>
              <View>
                <Text className="text-xs font-black text-gray-900 uppercase">DLC: Poulet</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase">10 Avril</Text>
              </View>
            </View>
            <ChevronRight size={16} color="#D1D5DB" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
