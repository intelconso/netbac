import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Scan, Plus, LogOut, AlertTriangle } from 'lucide-react-native';
import UnitIcon from '../../src/components/UnitIcon';
import ZoneIcon from '../../src/components/ZoneIcon';
import { useStore } from '../../src/lib/store';
import { signOut } from '../../src/lib/firebase';
import { signOutGoogle } from '../../src/lib/googleSignIn';
import { getDaysRemaining } from '../../src/lib/utils';

export default function HomeScreen() {
  const router = useRouter();
  const { zones, storageUnits, bacs, shelves, products } = useStore();

  const activeProducts = useMemo(() => products.filter((p) => p.status === 'active'), [products]);

  const expiringSoon = useMemo(() => {
    return [...activeProducts]
      .filter((p) => getDaysRemaining(p.dlc) <= 2)
      .sort((a, b) => a.dlc - b.dlc)
      .slice(0, 5);
  }, [activeProducts]);

  const todayCount = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    return activeProducts.filter((p) => p.addedAt >= startOfToday.getTime()).length;
  }, [activeProducts]);

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

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 96 }}>
      <View className="flex-row justify-between items-start">
        <Text className="text-xl font-black text-gray-900 uppercase">Tableau de Bord</Text>
        <Pressable onPress={handleSignOut} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center active:bg-gray-100">
          <LogOut size={16} color="#9CA3AF" />
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/express-add')} className="bg-primary p-6 rounded-3xl mt-8">
        <View className="flex-row items-center gap-5">
          <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center">
            <Plus size={32} color="#fff" />
          </View>
          <View>
            <Text className="text-xl font-black text-white uppercase">Étiquetage</Text>
            <Text className="text-[9px] font-black text-white/60 uppercase tracking-widest mt-1">Traçabilité instantanée</Text>
          </View>
          <View className="ml-auto">
            <Scan size={48} color="rgba(255,255,255,0.2)" />
          </View>
        </View>
      </Pressable>

      <View className="flex-row gap-3 mt-6">
        <Pressable
          onPress={() => router.push('/(tabs)/labels' as any)}
          className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 gap-1 active:bg-gray-50"
        >
          <Text className="text-[9px] font-bold text-gray-400 uppercase" numberOfLines={1} adjustsFontSizeToFit>Actifs</Text>
          <Text className="text-2xl font-black text-gray-900">{activeProducts.length}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: '/(tabs)/labels' as any, params: { filter: 'today' } })}
          className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 gap-1 active:bg-gray-50"
        >
          <Text className="text-[9px] font-bold text-gray-400 uppercase" numberOfLines={1} adjustsFontSizeToFit>Aujourd'hui</Text>
          <Text className="text-2xl font-black text-primary">{todayCount}</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/alerts' as any)}
          className="flex-1 bg-white p-4 rounded-2xl border border-gray-100 gap-1 active:bg-gray-50"
        >
          <View className="flex-row items-center gap-1">
            <AlertTriangle size={10} color="#F59E0B" />
            <Text className="text-[9px] font-bold text-gray-400 uppercase flex-1" numberOfLines={1} adjustsFontSizeToFit>À surveiller</Text>
          </View>
          <Text className="text-2xl font-black text-amber-500">{expiringSoon.length}</Text>
        </Pressable>
      </View>

      <View className="mt-8 gap-6">
        <Text className="text-sm font-bold text-gray-900">Inventaire par Zone</Text>
        {zones.length === 0 ? (
          <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Aucune zone configurée</Text>
            <Pressable onPress={() => router.push('/(tabs)/settings' as any)} className="px-4 py-2 bg-primary/10 rounded-xl">
              <Text className="text-[10px] font-black text-primary uppercase">Configurer dans Réglages</Text>
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
      </View>
    </ScrollView>
  );
}
