import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Search, Trash2, CheckCircle2, Edit2 } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { cn, formatDate, getDaysRemaining, getStatusColor } from '../../src/lib/utils';
import ProductLabel from '../../src/components/ProductLabel';
import ZoneIcon from '../../src/components/ZoneIcon';

export default function AllLabelsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ filter?: string }>();
  const todayFilter = params.filter === 'today';
  const { products, updateProductStatus, zones, storageUnits, shelves, bacs } = useStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  const activeProducts = products.filter((p) => p.status === 'active');
  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();

  const filteredProducts = activeProducts.filter((p) => {
    if (todayFilter && p.addedAt < startOfToday) return false;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (selectedZoneId === 'all') return matchesSearch;
    const bac = bacs.find((b) => b.id === p.bacId);
    const shelf = shelves.find((s) => s.id === bac?.shelfId);
    const unit = storageUnits.find((u) => u.id === shelf?.unitId);
    return matchesSearch && unit?.zoneId === selectedZoneId;
  });

  const handleRemove = (status: 'used' | 'discarded') => {
    if (selectedProduct) {
      updateProductStatus(selectedProduct.id, status);
      setSelectedProduct(null);
      setShowRemoveConfirm(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50 gap-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">{todayFilter ? "Étiquettes du Jour" : 'Toutes les Étiquettes'}</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">{todayFilter ? `${filteredProducts.length} créées aujourd'hui` : "Vue d'ensemble"}</Text>
          </View>
          {todayFilter && (
            <Pressable onPress={() => router.setParams({ filter: '' })} className="bg-gray-50 px-3 py-1.5 rounded-xl">
              <Text className="text-[9px] font-black text-gray-400 uppercase">Voir tout</Text>
            </Pressable>
          )}
        </View>

        <View className="relative">
          <View className="absolute left-4 top-3.5 z-10"><Search size={16} color="#9CA3AF" /></View>
          <TextInput
            placeholder="Rechercher..." value={searchTerm} onChangeText={setSearchTerm}
            className="pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Pressable onPress={() => setSelectedZoneId('all')} className={cn('px-4 py-2 rounded-xl', selectedZoneId === 'all' ? 'bg-primary' : 'bg-gray-50')}>
            <Text className={cn('text-[9px] font-black uppercase tracking-widest', selectedZoneId === 'all' ? 'text-white' : 'text-gray-400')}>Tout</Text>
          </Pressable>
          {zones.map((zone) => {
            const active = selectedZoneId === zone.id;
            return (
              <Pressable key={zone.id} onPress={() => setSelectedZoneId(zone.id)} className={cn('px-4 py-2 rounded-xl flex-row items-center gap-2', active ? 'bg-primary' : 'bg-gray-50')}>
                <ZoneIcon type={zone.type} size={12} color={active ? '#fff' : '#9CA3AF'} />
                <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-white' : 'text-gray-400')}>{zone.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 8 }}>
        {filteredProducts.length > 0 ? filteredProducts.map((product) => {
          const days = getDaysRemaining(product.dlc);
          const color = getStatusColor(product.dlc);
          const bac = bacs.find((b) => b.id === product.bacId);
          return (
            <Pressable
              key={product.id}
              onPress={() => setSelectedProduct(product)}
              className="bg-white p-3 rounded-xl border border-gray-100 flex-row items-center gap-3 active:bg-gray-50"
            >
              <View className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
              <View className="flex-1">
                <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{product.name}</Text>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" numberOfLines={1}>
                  {bac?.name ?? '—'} · {formatDate(product.dlc)}
                </Text>
              </View>
              <View className="px-2.5 py-1 rounded-lg" style={{ backgroundColor: color + '20' }}>
                <Text className="text-[9px] font-black uppercase tracking-widest" style={{ color }}>
                  {days < 0 ? 'Périmé' : days === 0 ? "Auj." : `J-${days}`}
                </Text>
              </View>
            </Pressable>
          );
        }) : (
          <View className="py-20 items-center">
            <Text className="text-sm text-gray-400 font-medium">Aucun produit trouvé</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!selectedProduct} transparent animationType="fade" onRequestClose={() => setSelectedProduct(null)}>
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full bg-white rounded-3xl overflow-hidden" style={{ maxWidth: 400 }}>
            {showRemoveConfirm ? (
              <View className="p-8 gap-8">
                <View className="items-center gap-2">
                  <Text className="text-xl font-black uppercase text-gray-900">Retirer</Text>
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pourquoi ?</Text>
                </View>
                <View className="gap-4">
                  <Pressable onPress={() => handleRemove('used')} className="bg-success p-6 rounded-2xl flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center">
                      <CheckCircle2 size={24} color="#fff" />
                    </View>
                    <View>
                      <Text className="font-black uppercase text-white">Utilisé</Text>
                      <Text className="text-[9px] font-bold text-white/70 uppercase">Consommé</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => handleRemove('discarded')} className="bg-danger p-6 rounded-2xl flex-row items-center gap-4">
                    <View className="w-12 h-12 rounded-xl bg-white/20 items-center justify-center">
                      <Trash2 size={24} color="#fff" />
                    </View>
                    <View>
                      <Text className="font-black uppercase text-white">Jeté</Text>
                      <Text className="text-[9px] font-bold text-white/70 uppercase">Périmé</Text>
                    </View>
                  </Pressable>
                </View>
                <Pressable onPress={() => setShowRemoveConfirm(false)} className="py-4">
                  <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Annuler</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {selectedProduct && <ProductLabel product={selectedProduct} />}
                <View className="flex-row border-t border-gray-100">
                  <Pressable onPress={() => setShowRemoveConfirm(true)} className="flex-1 py-6 bg-danger flex-row items-center justify-center gap-2">
                    <Trash2 size={16} color="#fff" />
                    <Text className="text-white font-black uppercase tracking-widest text-[10px]">Retirer</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      const pid = selectedProduct?.id;
                      setSelectedProduct(null);
                      if (pid) router.push({ pathname: '/add-product', params: { productId: pid, editMode: 'true' } });
                    }}
                    className="flex-1 py-6 bg-primary flex-row items-center justify-center gap-2"
                  >
                    <Edit2 size={16} color="#fff" />
                    <Text className="text-white font-black uppercase tracking-widest text-[10px]">Modifier</Text>
                  </Pressable>
                  <Pressable onPress={() => setSelectedProduct(null)} className="flex-1 py-6 bg-gray-900">
                    <Text className="text-white font-black uppercase tracking-widest text-[10px] text-center">Fermer</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
