import React from 'react';
import { View, Text } from 'react-native';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { formatRelativeTime } from '../lib/utils';

export default function SyncRow() {
  const status = useStore((s) => s.lastSyncStatus);
  const at = useStore((s) => s.lastSyncAt);
  const error = useStore((s) => s.lastSyncError);

  let Icon = Cloud;
  let iconColor = '#10B981';
  let bgColor = 'bg-primary/10';
  let label = 'Synchronisé';
  let detail = at ? formatRelativeTime(at) : 'Jamais synchronisé';

  if (status === 'syncing') {
    Icon = RefreshCw;
    iconColor = '#3B82F6';
    bgColor = 'bg-blue-50';
    label = 'Synchronisation...';
    detail = 'En cours';
  } else if (status === 'error') {
    Icon = AlertCircle;
    iconColor = '#EF4444';
    bgColor = 'bg-red-50';
    label = 'Erreur de synchronisation';
    detail = error ?? 'Vérifiez la connexion';
  } else if (status === 'idle' && !at) {
    Icon = CloudOff;
    iconColor = '#9CA3AF';
    bgColor = 'bg-gray-50';
    label = 'Hors ligne';
    detail = 'Connexion requise';
  }

  return (
    <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4">
      <View className={`w-12 h-12 rounded-xl items-center justify-center ${bgColor}`}>
        <Icon size={20} color={iconColor} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-black text-gray-900 uppercase">{label}</Text>
        <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" numberOfLines={1}>
          {detail}
        </Text>
      </View>
    </View>
  );
}
