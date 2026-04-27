import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Download, Calendar, ShieldCheck, AlertTriangle, CheckCircle2, Filter, History, ChevronRight, Search,
} from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { formatDate, getDaysRemaining, cn } from '../src/lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ReportsScreen() {
  const router = useRouter();
  const { products, user, tempLogs, cleaningTasks, storageUnits, zones, shelves, bacs } = useStore();

  const [reportType, setReportType] = useState<'haccp' | 'stock' | 'waste' | 'history'>('stock');
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedUnitId, setSelectedUnitId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(true);

  const filteredProducts = products.filter((p) => {
    const bac = bacs.find((b) => b.id === p.bacId);
    const shelf = shelves.find((s) => s.id === bac?.shelfId);
    const unit = storageUnits.find((u) => u.id === shelf?.unitId);

    const matchesZone = selectedZoneId === 'all' || unit?.zoneId === selectedZoneId;
    const matchesUnit = selectedUnitId === 'all' || unit?.id === selectedUnitId;
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (reportType === 'stock') return p.status === 'active' && matchesZone && matchesUnit && matchesSearch;
    if (reportType === 'waste') return p.status === 'discarded' && matchesZone && matchesUnit && matchesSearch;
    return matchesZone && matchesUnit && matchesSearch;
  });

  const expiredProducts = filteredProducts.filter((p) => p.status === 'active' && getDaysRemaining(p.dlc) < 0);
  const haccpScore = Math.round(
    (tempLogs.filter((l) => l.status === 'ok').length / (tempLogs.length || 1)) * 50 +
    (cleaningTasks.filter((c) => c.lastDone).length / (cleaningTasks.length || 1)) * 50
  );

  const generateReport = () => {
    Alert.alert('Rapport', `${reportType.toUpperCase()} généré — prêt au téléchargement.`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center justify-between bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Rapports & HACCP</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Documents</Text>
          </View>
        </View>
        <Pressable onPress={generateReport} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
          <Download size={18} color="#fff" />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }}>
        <View className="flex-row gap-2 p-1 bg-gray-100 rounded-2xl">
          {(['haccp', 'stock', 'waste', 'history'] as const)
            .filter((t) => t !== 'haccp' || user?.settings?.enableTemperature || user?.settings?.enableCleaning)
            .map((type) => (
              <Pressable key={type} onPress={() => setReportType(type)} className={cn('flex-1 px-4 py-3 rounded-xl', reportType === type ? 'bg-white' : '')}>
                <Text className={cn('text-[10px] font-black uppercase text-center', reportType === type ? 'text-gray-900' : 'text-gray-400')}>
                  {type === 'haccp' ? 'HACCP' : type === 'stock' ? 'Stock' : type === 'waste' ? 'Pertes' : 'Historique'}
                </Text>
              </Pressable>
            ))}
        </View>

        <View className="bg-gray-900 rounded-3xl p-6 gap-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-[9px] font-black text-primary uppercase tracking-widest">Rapport {formatDate(Date.now())}</Text>
              <Text className="text-xl font-black uppercase text-white">Résumé Conformité</Text>
            </View>
            <View className="bg-white/10 p-2 rounded-xl">
              <Calendar size={20} color="#10B981" />
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5">
              <Text className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Score</Text>
              <Text className="text-2xl font-black text-primary">{haccpScore}%</Text>
            </View>
            <View className="flex-1 bg-white/5 p-4 rounded-2xl border border-white/5">
              <Text className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Alertes</Text>
              <Text className="text-2xl font-black text-danger">{expiredProducts.length}</Text>
            </View>
          </View>
        </View>

        <Pressable onPress={() => router.push('/journal')} className="p-4 bg-white rounded-2xl border border-gray-100 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center">
              <History size={18} color="#3B82F6" />
            </View>
            <View>
              <Text className="text-xs font-black text-gray-900 uppercase">Journal</Text>
              <Text className="text-[9px] font-bold text-gray-400 uppercase">Historique & HACCP</Text>
            </View>
          </View>
          <ChevronRight size={18} color="#D1D5DB" />
        </Pressable>

        <View className="gap-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Configuration</Text>
            <Pressable onPress={() => setShowFilters(!showFilters)} className="flex-row items-center gap-1">
              <Filter size={12} color={showFilters ? '#10B981' : '#9CA3AF'} />
              <Text className={cn('text-[9px] font-black uppercase', showFilters ? 'text-primary' : 'text-gray-400')}>{showFilters ? 'Fermer' : 'Filtrer'}</Text>
            </Pressable>
          </View>

          {showFilters && (
            <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-4">
              <View className="gap-1.5">
                <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Zone</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <Pressable onPress={() => { setSelectedZoneId('all'); setSelectedUnitId('all'); }} className={cn('px-3 py-2 rounded-lg', selectedZoneId === 'all' ? 'bg-primary' : 'bg-gray-50')}>
                    <Text className={cn('text-[10px] font-bold uppercase', selectedZoneId === 'all' ? 'text-white' : 'text-gray-400')}>Toutes</Text>
                  </Pressable>
                  {zones.map((z) => (
                    <Pressable key={z.id} onPress={() => { setSelectedZoneId(z.id); setSelectedUnitId('all'); }} className={cn('px-3 py-2 rounded-lg', selectedZoneId === z.id ? 'bg-primary' : 'bg-gray-50')}>
                      <Text className={cn('text-[10px] font-bold uppercase', selectedZoneId === z.id ? 'text-white' : 'text-gray-400')}>{z.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View className="gap-1.5">
                <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Unité</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  <Pressable onPress={() => setSelectedUnitId('all')} className={cn('px-3 py-2 rounded-lg', selectedUnitId === 'all' ? 'bg-primary' : 'bg-gray-50')}>
                    <Text className={cn('text-[10px] font-bold uppercase', selectedUnitId === 'all' ? 'text-white' : 'text-gray-400')}>Toutes</Text>
                  </Pressable>
                  {storageUnits.filter((u) => selectedZoneId === 'all' || u.zoneId === selectedZoneId).map((u) => (
                    <Pressable key={u.id} onPress={() => setSelectedUnitId(u.id)} className={cn('px-3 py-2 rounded-lg', selectedUnitId === u.id ? 'bg-primary' : 'bg-gray-50')}>
                      <Text className={cn('text-[10px] font-bold uppercase', selectedUnitId === u.id ? 'text-white' : 'text-gray-400')}>{u.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <View className="gap-1.5">
                <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Recherche</Text>
                <View className="relative">
                  <View className="absolute left-3 top-2.5 z-10"><Search size={14} color="#9CA3AF" /></View>
                  <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder="Ex: Poulet..." className="pl-10 pr-4 py-2 bg-gray-50 rounded-xl text-[10px] font-bold" />
                </View>
              </View>
            </View>
          )}
        </View>

        {reportType === 'haccp' && (
          <View className="gap-3">
            <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-success/10 items-center justify-center">
                  <ShieldCheck size={20} color="#10B981" />
                </View>
                <View>
                  <Text className="text-xs font-black text-gray-900 uppercase">Traçabilité</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase">Tous lots enregistrés</Text>
                </View>
              </View>
              <Text className="text-[10px] font-black text-success uppercase">OK</Text>
            </View>
            <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-10 h-10 rounded-xl bg-alert/10 items-center justify-center">
                  <AlertTriangle size={20} color="#F59E0B" />
                </View>
                <View>
                  <Text className="text-xs font-black text-gray-900 uppercase">DLC</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase">{expiredProducts.length} anomalies</Text>
                </View>
              </View>
              <Text className="text-[10px] font-black text-alert uppercase">ACTION</Text>
            </View>
          </View>
        )}

        {(reportType === 'stock' || reportType === 'waste') && (
          <View className="gap-3">
            <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-3">
              <View className="flex-row justify-between items-center border-b border-gray-50 pb-2">
                <Text className="text-xs font-black text-gray-900 uppercase">{reportType === 'stock' ? 'Inventaire' : 'Pertes'}</Text>
                <Text className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase">{filteredProducts.length}</Text>
              </View>
              {filteredProducts.length > 0 ? filteredProducts.map((product) => {
                const days = getDaysRemaining(product.dlc);
                return (
                  <View key={product.id} className="flex-row justify-between items-start py-1">
                    <View className="flex-1">
                      <Text className="text-[10px] font-bold text-gray-800 uppercase" numberOfLines={1}>{product.name}</Text>
                      <Text className="text-[8px] text-gray-400 font-bold uppercase">DLC: {formatDate(product.dlc)}</Text>
                    </View>
                    {reportType === 'stock' ? (
                      <View className={cn('px-2 py-0.5 rounded-full', days < 0 ? 'bg-danger/10' : days <= 1 ? 'bg-alert/10' : 'bg-success/10')}>
                        <Text className={cn('text-[8px] font-black uppercase', days < 0 ? 'text-danger' : days <= 1 ? 'text-alert' : 'text-success')}>
                          {days < 0 ? 'Expiré' : `${days}j`}
                        </Text>
                      </View>
                    ) : (
                      <View className="items-end">
                        <Text className="text-[9px] font-black text-danger uppercase">Jeté</Text>
                        <Text className="text-[8px] font-bold text-gray-400 uppercase">{product.quantity} {product.unit}</Text>
                      </View>
                    )}
                  </View>
                );
              }) : (
                <View className="py-6 items-center">
                  <Text className="text-[9px] text-gray-400 font-bold uppercase">Aucune donnée</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {reportType === 'history' && (
          <View className="bg-white p-4 rounded-2xl border border-gray-100 gap-4">
            <View className="flex-row justify-between items-center border-b border-gray-50 pb-2">
              <Text className="text-xs font-black text-gray-900 uppercase">Audit</Text>
              <Text className="text-[9px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-full uppercase">{filteredProducts.length}</Text>
            </View>
            {filteredProducts.slice(0, 50).map((product) => (
              <View key={product.id} className="flex-row justify-between items-start py-2 border-b border-gray-50">
                <View className="flex-1">
                  <Text className="text-[10px] font-black text-gray-900 uppercase" numberOfLines={1}>{product.name}</Text>
                  <View className="flex-row items-center gap-2 mt-0.5">
                    <View className={cn('px-1.5 py-0.5 rounded',
                      product.status === 'active' ? 'bg-success/10' :
                      product.status === 'used' ? 'bg-blue-500/10' : 'bg-danger/10'
                    )}>
                      <Text className={cn('text-[7px] font-black uppercase',
                        product.status === 'active' ? 'text-success' :
                        product.status === 'used' ? 'text-blue-500' : 'text-danger'
                      )}>
                        {product.status === 'active' ? 'Stock' : product.status === 'used' ? 'Utilisé' : 'Jeté'}
                      </Text>
                    </View>
                    <Text className="text-[8px] text-gray-400 font-bold uppercase">Ajouté {formatDate(product.addedAt)}</Text>
                  </View>
                </View>
                <View className="items-end">
                  <Text className="text-[9px] font-black text-gray-900 uppercase">{product.quantity} {product.unit}</Text>
                  <Text className="text-[8px] font-bold text-gray-400 uppercase">Lot: {product.batchNumber || 'N/A'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View className="bg-white p-6 rounded-3xl border border-gray-100 gap-4">
          <View className="flex-row items-center gap-2">
            <CheckCircle2 size={16} color="#10B981" />
            <Text className="text-[10px] font-bold text-gray-900 uppercase tracking-widest">Validation</Text>
          </View>
          <View className="h-32 bg-gray-50 rounded-2xl border border-dashed border-gray-200 items-center justify-center">
            <Text className="text-[10px] font-bold text-gray-400 uppercase italic">Signer ici</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Chef: {user?.name}</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase">{formatDate(Date.now())}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
