import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, ChevronRight } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { cn, formatDate, getDaysRemaining } from '../../src/lib/utils';
import { Product, Bac } from '../../src/types';

interface AlertWithBac extends Product {
  days: number;
  bac?: Bac;
}

function AlertCard({ alert }: { alert: AlertWithBac }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/bac/${alert.bacId}` as any)}
      className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4"
    >
      <View className="w-12 h-12 rounded-xl bg-gray-50 items-center justify-center">
        <Text className="text-xl">{alert.bac?.icon}</Text>
      </View>
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
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}

export default function AlertsScreen() {
  const { products, bacs } = useStore();

  const activeAlerts: AlertWithBac[] = products
    .filter((p) => p.status === 'active')
    .map((p) => ({ ...p, days: getDaysRemaining(p.dlc), bac: bacs.find((b) => b.id === p.bacId) }))
    .sort((a, b) => a.days - b.days);

  const critical = activeAlerts.filter((a) => a.days <= 0);
  const warning = activeAlerts.filter((a) => a.days > 0 && a.days <= 2);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24 }}>
      <View className="mb-6">
        <Text className="text-sm font-black text-gray-900 uppercase">Alertes DLC</Text>
        <Text className="text-[9px] font-bold text-danger uppercase tracking-widest mt-0.5">Contrôle sanitaire</Text>
      </View>

      {critical.length > 0 && (
        <View className="gap-4 mb-8">
          <Text className="text-xs font-bold text-danger uppercase tracking-widest">Expirés ({critical.length})</Text>
          <View className="gap-3">
            {critical.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
          </View>
        </View>
      )}

      {warning.length > 0 && (
        <View className="gap-4 mb-8">
          <Text className="text-xs font-bold text-alert uppercase tracking-widest">Expire bientôt ({warning.length})</Text>
          <View className="gap-3">
            {warning.map((alert) => <AlertCard key={alert.id} alert={alert} />)}
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
  );
}
