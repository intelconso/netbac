import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';

// Tâches de nettoyage des unités. Gated by the enableCleaning setting,
// same as in the former journal HACCP tab.
export default function CleaningSection() {
  const { cleaningTasks, storageUnits, completeCleaningTask, user } = useActiveStore();

  if (!user?.settings?.enableCleaning) return null;

  return (
    <View className="gap-4">
      <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nettoyage</Text>
      {cleaningTasks.map((task) => (
        <View key={task.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center">
              <Sparkles size={18} color="#3B82F6" />
            </View>
            <View>
              <Text className="text-xs font-black text-gray-900 uppercase">{task.name}</Text>
              <Text className="text-[9px] font-bold text-gray-400 uppercase">
                {storageUnits.find((u) => u.id === task.unitId)?.name} • {task.frequency}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => completeCleaningTask(task.id)} className="px-4 py-2 bg-gray-50 rounded-xl">
            <Text className="text-[9px] font-black text-primary uppercase">Valider</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
