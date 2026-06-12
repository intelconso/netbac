import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, BackHandler } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { AlertCircle, CheckCircle2, ChevronRight, Circle, Trash2 } from 'lucide-react-native';
import { useActiveStore } from '../../src/lib/useActive';
import { cn, formatDate, getDaysRemaining } from '../../src/lib/utils';
import { Product, Bac } from '../../src/types';
import UsedAtPickerModal from '../../src/components/UsedAtPickerModal';

interface AlertWithBac extends Product {
  days: number;
  bac?: Bac;
}

function AlertCard({
  alert,
  selectMode,
  selected,
  onPress,
  onLongPress,
}: {
  alert: AlertWithBac;
  selectMode: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className={cn(
        'bg-white p-4 rounded-2xl border flex-row items-center gap-4',
        selected ? 'border-primary bg-primary/5' : 'border-gray-100'
      )}
    >
      {selectMode && (
        selected
          ? <CheckCircle2 size={20} color="#10B981" />
          : <Circle size={20} color="#D1D5DB" />
      )}
      <View className="flex-1">
        <Text className="font-bold text-gray-900">{alert.name}</Text>
        <Text className="text-[10px] font-bold text-gray-400 uppercase">
          Dans {alert.bac?.name} • {alert.quantity} {alert.unit}
        </Text>
      </View>
      <View className="items-end">
        <Text className={cn('text-xs font-bold', alert.days <= 0 ? 'text-danger' : 'text-alert')}>
          {alert.days <= 0 ? 'EXPIRÉ' : `J-${alert.days}`}
        </Text>
        <Text className="text-[8px] font-medium text-gray-400 uppercase">{formatDate(alert.dlc)}</Text>
      </View>
      {!selectMode && <ChevronRight size={16} color="#D1D5DB" />}
    </Pressable>
  );
}

export default function AlertsScreen() {
  const router = useRouter();
  const { products, bacs, updateProductStatus } = useActiveStore();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<'used' | 'discarded' | null>(null);
  // Expired products being bulk-marked "used" each need a back-dated usedAt
  // (validated against their own [addedAt..dlc] window), so they go through
  // the picker one at a time instead of a single batch write.
  const [usedAtQueue, setUsedAtQueue] = useState<AlertWithBac[]>([]);

  const activeAlerts: AlertWithBac[] = products
    .filter((p) => p.status === 'active')
    .map((p) => ({ ...p, days: getDaysRemaining(p.dlc), bac: bacs.find((b) => b.id === p.bacId) }))
    .sort((a, b) => a.days - b.days);

  const critical = activeAlerts.filter((a) => a.days <= 0);
  const warning = activeAlerts.filter((a) => a.days > 0 && a.days <= 2);
  const visibleAlerts = [...critical, ...warning];

  const selected = activeAlerts.filter((a) => selectedIds.includes(a.id));
  const allSelected = visibleAlerts.length > 0 && selectedIds.length === visibleAlerts.length;

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds([]);
    setBulkStatus(null);
  };

  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (usedAtQueue.length > 0) { setUsedAtQueue([]); exitSelectMode(); return true; }
        if (bulkStatus) { setBulkStatus(null); return true; }
        if (selectMode) { exitSelectMode(); return true; }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [usedAtQueue, bulkStatus, selectMode])
  );

  const toggleSelect = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));

  const enterSelectMode = (id?: string) => {
    setSelectMode(true);
    if (id) setSelectedIds([id]);
  };

  const handleCardPress = (alert: AlertWithBac) => {
    if (selectMode) toggleSelect(alert.id);
    else router.push(`/container/${alert.bacId}` as any);
  };

  const expiredInSelection = selected.filter((a) => a.dlc < Date.now());

  const handleConfirmBulk = () => {
    if (!bulkStatus) return;
    if (bulkStatus === 'discarded') {
      selected.forEach((a) => updateProductStatus(a.id, 'discarded'));
      exitSelectMode();
      return;
    }
    // "Utilisé" : les non-expirés passent directement, les expirés défilent
    // dans le sélecteur de date d'utilisation.
    selected
      .filter((a) => a.dlc >= Date.now())
      .forEach((a) => updateProductStatus(a.id, 'used'));
    setBulkStatus(null);
    if (expiredInSelection.length > 0) {
      setUsedAtQueue(expiredInSelection);
    } else {
      exitSelectMode();
    }
  };

  const handleUsedAtConfirm = (usedAt: number) => {
    const [current, ...rest] = usedAtQueue;
    if (current) updateProductStatus(current.id, 'used', { usedAt });
    setUsedAtQueue(rest);
    if (rest.length === 0) exitSelectMode();
  };

  const cardProps = (alert: AlertWithBac) => ({
    alert,
    selectMode,
    selected: selectedIds.includes(alert.id),
    onPress: () => handleCardPress(alert),
    onLongPress: () => (selectMode ? toggleSelect(alert.id) : enterSelectMode(alert.id)),
  });

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24 }}>
        <View className="mb-6 flex-row items-end justify-between">
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Alertes DLC</Text>
            <Text className="text-[9px] font-bold text-danger uppercase tracking-widest mt-0.5">Contrôle sanitaire</Text>
          </View>
          {visibleAlerts.length > 0 && (
            selectMode ? (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => setSelectedIds(allSelected ? [] : visibleAlerts.map((a) => a.id))}
                  className="bg-gray-900 px-3 py-1.5 rounded-xl"
                >
                  <Text className="text-[9px] font-black text-white uppercase">
                    {allSelected ? 'Aucun' : 'Tout'}
                  </Text>
                </Pressable>
                <Pressable onPress={exitSelectMode} className="bg-gray-50 px-3 py-1.5 rounded-xl">
                  <Text className="text-[9px] font-black text-gray-400 uppercase">Annuler</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={() => enterSelectMode()} className="bg-gray-50 px-3 py-1.5 rounded-xl">
                <Text className="text-[9px] font-black text-gray-400 uppercase">Sélectionner</Text>
              </Pressable>
            )
          )}
        </View>

        {critical.length > 0 && (
          <View className="gap-4 mb-8">
            <Text className="text-xs font-bold text-danger uppercase tracking-widest">Expirés ({critical.length})</Text>
            <View className="gap-3">
              {critical.map((alert) => <AlertCard key={alert.id} {...cardProps(alert)} />)}
            </View>
          </View>
        )}

        {warning.length > 0 && (
          <View className="gap-4 mb-8">
            <Text className="text-xs font-bold text-alert uppercase tracking-widest">Expire bientôt ({warning.length})</Text>
            <View className="gap-3">
              {warning.map((alert) => <AlertCard key={alert.id} {...cardProps(alert)} />)}
            </View>
          </View>
        )}

        {activeAlerts.length === 0 && (
          <View className="py-20 items-center gap-4">
            <View className="w-16 h-16 bg-success/10 rounded-full items-center justify-center">
              <AlertCircle size={32} color="#10B981" />
            </View>
            <Text className="text-sm text-gray-400 font-medium">Aucune alerte en cours. Tout est en règle !</Text>
          </View>
        )}
      </ScrollView>

      {selectMode && (
        <View className="bg-white border-t border-gray-100 px-6 py-4 gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
            {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
          </Text>
          <View className="flex-row gap-3">
            <Pressable
              disabled={selectedIds.length === 0}
              onPress={() => setBulkStatus('used')}
              className={cn('flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 bg-success', selectedIds.length === 0 && 'opacity-40')}
            >
              <CheckCircle2 size={16} color="#fff" />
              <Text className="text-white font-black uppercase text-xs">Utilisé</Text>
            </Pressable>
            <Pressable
              disabled={selectedIds.length === 0}
              onPress={() => setBulkStatus('discarded')}
              className={cn('flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 bg-danger', selectedIds.length === 0 && 'opacity-40')}
            >
              <Trash2 size={16} color="#fff" />
              <Text className="text-white font-black uppercase text-xs">Jeté</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={!!bulkStatus} transparent animationType="fade" onRequestClose={() => setBulkStatus(null)}>
        <View className="flex-1 bg-black/90 items-center justify-center p-6">
          <View className="w-full bg-white rounded-3xl p-8 gap-6" style={{ maxWidth: 400 }}>
            <View className="items-center gap-2">
              <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-2', bulkStatus === 'used' ? 'bg-success/10' : 'bg-danger/10')}>
                {bulkStatus === 'used'
                  ? <CheckCircle2 size={28} color="#10B981" />
                  : <Trash2 size={28} color="#EF4444" />}
              </View>
              <Text className="text-xl font-black uppercase text-gray-900 text-center">
                {bulkStatus === 'used' ? 'Marquer utilisé' : 'Marquer jeté'} ?
              </Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                {selectedIds.length} étiquette{selectedIds.length > 1 ? 's' : ''}
              </Text>
              {bulkStatus === 'used' && expiredInSelection.length > 0 && (
                <Text className="text-[10px] font-bold text-alert uppercase tracking-widest text-center">
                  {expiredInSelection.length} expirée{expiredInSelection.length > 1 ? 's' : ''} : date d'utilisation demandée
                </Text>
              )}
            </View>
            <View className="gap-3">
              <Pressable onPress={handleConfirmBulk} className={cn('py-4 rounded-2xl', bulkStatus === 'used' ? 'bg-success' : 'bg-danger')}>
                <Text className="text-white font-black uppercase text-xs text-center">
                  {bulkStatus === 'used' ? 'Utilisé' : 'Jeté'}
                </Text>
              </Pressable>
              <Pressable onPress={() => setBulkStatus(null)} className="bg-gray-50 py-4 rounded-2xl">
                <Text className="text-gray-400 font-black uppercase text-xs text-center">Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {usedAtQueue.length > 0 && (
        <UsedAtPickerModal
          key={usedAtQueue[0].id}
          visible
          productName={`${usedAtQueue[0].name} (${usedAtQueue.length} restante${usedAtQueue.length > 1 ? 's' : ''})`}
          addedAt={usedAtQueue[0].addedAt}
          dlc={usedAtQueue[0].dlc}
          onCancel={() => { setUsedAtQueue([]); exitSelectMode(); }}
          onConfirm={handleUsedAtConfirm}
        />
      )}
    </View>
  );
}
