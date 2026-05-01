import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Trash2, CheckCircle2, History } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { cn, formatDate, getDaysRemaining } from '../../src/lib/utils';
import ProductLabel from '../../src/components/ProductLabel';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BacDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { bacs, products, updateProductStatus, deleteProduct } = useStore();
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const bac = bacs.find((b) => b.id === id);
  const bacProducts = products.filter((p) => p.bacId === id && p.status === 'active');
  const history = products.filter((p) => p.bacId === id && p.status !== 'active').slice(0, 5);

  if (!bac) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Text className="text-gray-400">Bac non trouvé</Text>
      </SafeAreaView>
    );
  }

  const getStatusClass = (days: number) => {
    if (days < 0) return 'border-danger';
    if (days <= 1) return 'border-alert';
    return 'border-success';
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
          <ArrowLeft size={20} color="#9CA3AF" />
        </Pressable>
        <View className="flex-row items-center gap-3">
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">BAC {bac.name}</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Détails du support</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }}>
        <View className="gap-4">
          <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Contenu ({bacProducts.length})</Text>
          <View className="gap-3">
            {bacProducts.map((product) => {
              const days = getDaysRemaining(product.dlc);
              return (
                <View key={product.id} className={cn('bg-white rounded-2xl border-2 overflow-hidden', getStatusClass(days))}>
                  <Pressable onPress={() => setSelectedProduct(product)}>
                    <ProductLabel product={product} />
                  </Pressable>
                  <View className="flex-row bg-gray-50 border-t border-gray-100">
                    {days < 0 ? (
                      <Pressable onPress={() => deleteProduct(product.id)} className="flex-1 bg-danger py-4 flex-row items-center justify-center gap-2">
                        <Trash2 size={14} color="#fff" />
                        <Text className="text-[10px] font-black uppercase text-white">JETER (EXPIRÉ)</Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable onPress={() => updateProductStatus(product.id, 'used')} className="flex-1 py-4 flex-row items-center justify-center gap-2 border-r border-gray-100">
                          <CheckCircle2 size={14} color="#374151" />
                          <Text className="text-[10px] font-black uppercase text-gray-700">Valider Sortie</Text>
                        </Pressable>
                        <Pressable onPress={() => deleteProduct(product.id)} className="w-14 py-4 items-center justify-center">
                          <Trash2 size={14} color="#374151" />
                        </Pressable>
                      </>
                    )}
                  </View>
                </View>
              );
            })}
            {bacProducts.length === 0 && (
              <View className="py-12 items-center gap-2">
                <Text className="text-sm text-gray-400 font-medium">Ce bac est vide</Text>
              </View>
            )}
          </View>
        </View>

        {history.length > 0 && (
          <View className="gap-4">
            <View className="flex-row items-center gap-2">
              <History size={14} color="#9CA3AF" />
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest">Historique récent</Text>
            </View>
            <View className="gap-2">
              {history.map((item) => (
                <View key={item.id} className="flex-row justify-between bg-gray-50 p-2 rounded-lg">
                  <Text className="text-[10px] font-medium text-gray-400">{formatDate(item.modifiedAt)} — {item.name}</Text>
                  <Text className="text-[10px] font-medium text-gray-400 uppercase">{item.status === 'used' ? 'Utilisé' : 'Jeté'}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

<Modal visible={!!selectedProduct} transparent animationType="fade" onRequestClose={() => setSelectedProduct(null)}>
        <Pressable onPress={() => setSelectedProduct(null)} className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full bg-white rounded-3xl overflow-hidden" style={{ maxWidth: 400 }}>
            {selectedProduct && <ProductLabel product={selectedProduct} />}
            <Pressable onPress={() => setSelectedProduct(null)} className="py-6 bg-gray-900">
              <Text className="text-white font-black uppercase tracking-widest text-[10px] text-center">Fermer</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
