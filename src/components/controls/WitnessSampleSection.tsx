import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { CheckCircle2, Pencil, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { lastControllerName } from '../../lib/controller';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;

// Prélèvement des plats témoins — restauration collective uniquement.
// Un oui/non par jour.
export default function WitnessSampleSection() {
  const store = useActiveStore();
  const { witnessSamples, addWitnessSample, updateWitnessSample } = store;

  const [controller, setController] = useState(() => lastControllerName(store));
  const [editing, setEditing] = useState(false);

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const todaySample = witnessSamples.find((s) => s.timestamp >= startOfToday && s.timestamp < startOfToday + DAY);

  const save = (taken: boolean) => {
    if (!controller.trim()) return;
    const data = { taken, operatorName: controller.trim() };
    if (todaySample) updateWitnessSample(todaySample.id, data);
    else addWitnessSample(data);
    setEditing(false);
  };

  if (todaySample && !editing) {
    return (
      <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', todaySample.taken ? 'bg-success/10' : 'bg-gray-100')}>
            {todaySample.taken
              ? <CheckCircle2 size={18} color="#10B981" />
              : <XCircle size={18} color="#9CA3AF" />}
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">
              {todaySample.taken ? 'Prélèvement effectué' : 'Pas de prélèvement'}
            </Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
              {format(new Date(todaySample.timestamp), 'HH:mm', { locale: fr })}
              {todaySample.operatorName ? ` • ${todaySample.operatorName}` : ''}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => { if (todaySample.operatorName) setController(todaySample.operatorName); setEditing(true); }}
          className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
        >
          <Pencil size={14} color="#9CA3AF" />
        </Pressable>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
        Pour la restauration collective uniquement
      </Text>
      <View className="gap-2">
        <Text className="text-[9px] font-bold text-gray-400 uppercase">Contrôleur</Text>
        <TextInput
          value={controller}
          onChangeText={setController}
          placeholder="Nom du contrôleur"
          className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold"
        />
      </View>
      <View className="flex-row gap-2">
        <Pressable
          disabled={!controller.trim()}
          onPress={() => save(true)}
          className={cn('flex-1 py-3 rounded-xl border bg-success/10 border-success items-center', !controller.trim() && 'opacity-40')}
        >
          <Text className="text-[10px] font-black uppercase text-success">Oui — prélevé</Text>
        </Pressable>
        <Pressable
          disabled={!controller.trim()}
          onPress={() => save(false)}
          className={cn('flex-1 py-3 rounded-xl border bg-gray-50 border-gray-200 items-center', !controller.trim() && 'opacity-40')}
        >
          <Text className="text-[10px] font-black uppercase text-gray-500">Non</Text>
        </Pressable>
      </View>
      {editing && (
        <Pressable onPress={() => setEditing(false)} className="py-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
        </Pressable>
      )}
    </View>
  );
}
