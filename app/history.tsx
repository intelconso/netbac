import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Search, History, Trash2, CheckCircle2 } from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { cn, formatDate } from '../src/lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HistoryScreen() {
  const router = useRouter();
  const { products, bacs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');

  const archivedProducts = products.filter((p) => p.status !== 'active').sort((a, b) => b.modifiedAt - a.modifiedAt);
  const filteredProducts = archivedProducts.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50 gap-4">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Historique</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Utilisés ou jetés</Text>
          </View>
        </View>
        <View className="relative">
          <View className="absolute left-4 top-3.5 z-10"><Search size={16} color="#9CA3AF" /></View>
          <TextInput placeholder="Rechercher..." value={searchTerm} onChangeText={setSearchTerm} className="pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold" />
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 16 }}>
        {filteredProducts.length > 0 ? filteredProducts.map((product) => {
          const bac = bacs.find((b) => b.id === product.bacId);
          return (
            <View key={product.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4">
              <View className={cn('w-12 h-12 rounded-xl items-center justify-center', product.status === 'used' ? 'bg-success/10' : 'bg-danger/10')}>
                {product.status === 'used' ? <CheckCircle2 size={24} color="#10B981" /> : <Trash2 size={24} color="#EF4444" />}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{product.name}</Text>
                  <View className={cn('px-2 py-0.5 rounded-full', product.status === 'used' ? 'bg-success/10' : 'bg-danger/10')}>
                    <Text className={cn('text-[8px] font-black uppercase', product.status === 'used' ? 'text-success' : 'text-danger')}>
                      {product.status === 'used' ? 'Utilisé' : 'Jeté'}
                    </Text>
                  </View>
                </View>
                <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                  {bac?.name || 'Inconnu'} • {formatDate(product.modifiedAt)}
                </Text>
              </View>
              <View className="items-end">
                <Text className="text-[10px] font-black text-gray-900">{product.quantity} {product.unit}</Text>
                <Text className="text-[8px] font-bold text-gray-400 uppercase">Lot: {product.batchNumber || 'N/A'}</Text>
              </View>
            </View>
          );
        }) : (
          <View className="py-20 items-center gap-4">
            <View className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center">
              <History size={32} color="#D1D5DB" />
            </View>
            <Text className="text-sm text-gray-400 font-medium uppercase tracking-widest">Aucun historique</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
