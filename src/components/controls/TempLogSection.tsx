import React, { useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { Thermometer } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn, formatDate } from '../../lib/utils';

// Relevé des températures des unités de stockage. Gated by the
// enableTemperature setting, same as in the former journal HACCP tab.
export default function TempLogSection() {
  const { tempLogs, storageUnits, addTempLog, user } = useActiveStore();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(storageUnits[0]?.id || '');
  const [tempValue, setTempValue] = useState('4');

  if (!user?.settings?.enableTemperature) return null;

  const handleAdd = () => {
    addTempLog({
      unitId: selectedUnitId,
      temperature: parseFloat(tempValue),
      operatorId: user?.id || 'admin',
      operatorName: user?.name || 'Admin',
      status: parseFloat(tempValue) <= 4 ? 'ok' : 'alert',
    });
    setIsAdding(false);
  };

  return (
    <View className="gap-4">
      <View className="flex-row justify-between items-center">
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Températures</Text>
        <Pressable onPress={() => setIsAdding(true)} className="flex-row items-center gap-1">
          <Thermometer size={12} color="#10B981" />
          <Text className="text-[10px] font-black text-primary uppercase">Nouveau</Text>
        </Pressable>
      </View>

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Unité</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {storageUnits.map((u) => (
                <Pressable key={u.id} onPress={() => setSelectedUnitId(u.id)} className={cn('px-3 py-2 rounded-xl border', selectedUnitId === u.id ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}>
                  <Text className={cn('text-[10px] font-bold uppercase', selectedUnitId === u.id ? 'text-primary' : 'text-gray-600')}>{u.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Temp. (°C)</Text>
            <TextInput value={tempValue} onChangeText={setTempValue} keyboardType="decimal-pad" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          </View>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setIsAdding(false)} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
            <Pressable onPress={handleAdd} className="flex-1 py-3 bg-primary rounded-xl"><Text className="text-[10px] font-black uppercase text-center text-white">Enregistrer</Text></Pressable>
          </View>
        </View>
      )}

      <View className="gap-3">
        {tempLogs.slice(0, 5).map((log) => (
          <View key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <View className={cn('w-10 h-10 rounded-xl items-center justify-center', log.status === 'ok' ? 'bg-success/10' : 'bg-danger/10')}>
                <Thermometer size={18} color={log.status === 'ok' ? '#10B981' : '#EF4444'} />
              </View>
              <View>
                <Text className="text-xs font-black text-gray-900 uppercase">{storageUnits.find((u) => u.id === log.unitId)?.name}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase">{formatDate(log.timestamp)}</Text>
              </View>
            </View>
            <Text className={cn('text-sm font-black', log.status === 'ok' ? 'text-success' : 'text-danger')}>{log.temperature}°C</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
