import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Scan, Plus, AlertTriangle, FileText, Eye } from 'lucide-react-native';
import { useActiveStore } from '../../src/lib/useActive';
import { cn, getDaysRemaining } from '../../src/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function HomeScreen() {
  const router = useRouter();
  const { products, user } = useActiveStore();

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products]);

  const expiringSoon = useMemo(() => {
    return [...activeProducts]
      .filter((p) => getDaysRemaining(p.dlc) <= 1)
      .sort((a, b) => a.dlc - b.dlc)
      .slice(0, 5);
  }, [activeProducts]);

  const todayCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return activeProducts.filter((p) => p.addedAt >= startOfToday.getTime()).length;
  }, [activeProducts]);

  const firstName = (user?.name || '').split(' ')[0];
  const today = format(new Date(), 'EEEE d MMMM', { locale: fr });

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 96, gap: 24 }}>
      {/* Header */}
      <View className="gap-1">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{today}</Text>
        <Text className="text-2xl font-black text-gray-900">
          {firstName ? `Bonjour, ${firstName}` : 'Tableau de bord'}
        </Text>
      </View>

      {/* Red alert */}
      {expiringSoon.length > 0 && (
        <Pressable onPress={() => router.push('/(tabs)/alerts' as any)} className="bg-danger p-5 rounded-3xl">
          <View className="flex-row items-center gap-4">
            <View className="w-12 h-12 rounded-2xl bg-white/20 items-center justify-center">
              <AlertTriangle size={26} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-black text-white uppercase">À surveiller</Text>
              <Text className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">
                {expiringSoon.length} {expiringSoon.length > 1 ? 'étiquettes critiques' : 'étiquette critique'}
              </Text>
            </View>
            <Text className="text-3xl font-black text-white/30">{expiringSoon.length}</Text>
          </View>
        </Pressable>
      )}

      {/* Primary CTA */}
      <Pressable onPress={() => router.push('/express-add')} className="bg-primary p-6 rounded-3xl overflow-hidden">
        <View className="flex-row items-center gap-5">
          <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center">
            <Plus size={30} color="#fff" />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black text-white uppercase">Étiquetage</Text>
            <Text className="text-[9px] font-bold text-white/70 uppercase tracking-widest mt-0.5">Traçabilité instantanée</Text>
          </View>
          <Scan size={44} color="rgba(255,255,255,0.18)" />
        </View>
      </Pressable>

      {/* Stats */}
      <View className="flex-row gap-4">
        <Pressable
          onPress={() => router.push('/(tabs)/labels' as any)}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center gap-1 active:bg-gray-50"
        >
          <Text className="text-3xl font-black text-gray-900">{activeProducts.length}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest" numberOfLines={1}>Actives</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/labels' as any, params: { filter: 'today' } })}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center gap-1 active:bg-gray-50"
        >
          <Text className="text-3xl font-black text-primary">{todayCount}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Aujourd'hui</Text>
        </Pressable>
      </View>

      {/* Action tiles */}
      <View className="flex-row gap-4">
        <Pressable
          onPress={() => router.push('/spatial' as any)}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center justify-center gap-3 active:bg-gray-50"
          style={{ aspectRatio: 1 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-blue-50 items-center justify-center">
            <Eye size={26} color="#3B82F6" />
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-xs font-black text-gray-900 uppercase tracking-widest">Vue spatiale</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Inventaire</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => router.push('/reports' as any)}
          className="flex-1 bg-white rounded-3xl border border-gray-100 p-5 items-center justify-center gap-3 active:bg-gray-50"
          style={{ aspectRatio: 1 }}
        >
          <View className="w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center">
            <FileText size={26} color="#10B981" />
          </View>
          <View className="items-center gap-0.5">
            <Text className="text-xs font-black text-gray-900 uppercase tracking-widest">Rapports</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">PDF HACCP</Text>
          </View>
        </Pressable>
      </View>
    </ScrollView>
  );
}
