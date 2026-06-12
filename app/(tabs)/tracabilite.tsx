import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronDown, ChevronRight, Droplets, History, Thermometer } from 'lucide-react-native';
import { useActiveStore } from '../../src/lib/useActive';
import { cn } from '../../src/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import OilCheckSection from '../../src/components/controls/OilCheckSection';
import FridgeTempSection from '../../src/components/controls/FridgeTempSection';
import { isColdUnit } from '../../src/lib/fridgeTemp';

// Hub des contrôles HACCP du registre papier. Chaque page du registre devient
// un contrôle ici : un composant src/components/controls/*Section.tsx branché
// sur sa carte.
export default function TracabiliteScreen() {
  const router = useRouter();
  const { oilChecks, fridgeTempChecks, storageUnits } = useActiveStore();
  const [openId, setOpenId] = useState<string | null>('oil');

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const oilDoneToday = oilChecks.some((c) => c.timestamp >= startOfToday);
  const oilOpen = openId === 'oil';

  const coldUnits = storageUnits.filter((u) => isColdUnit(u.type));
  const todayTemp = fridgeTempChecks.filter((c) => c.timestamp >= startOfToday);
  const tempDone = (svc: 'debut' | 'fin') => coldUnits.filter((u) => todayTemp.some((c) => c.unitId === u.id && c.service === svc)).length;
  const debutDone = tempDone('debut');
  const finDone = tempDone('fin');
  const tempComplete = coldUnits.length > 0 && debutDone === coldUnits.length && finDone === coldUnits.length;
  const tempOpen = openId === 'temp';

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, gap: 16 }}>
      <View className="mb-2 flex-row items-end justify-between">
        <View>
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            {format(new Date(), 'EEEE d MMMM yyyy', { locale: fr })}
          </Text>
          <Text className="text-sm font-black text-gray-900 uppercase mt-0.5">Traçabilité</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Contrôles HACCP du jour</Text>
        </View>
        <Pressable onPress={() => router.push('/controls-history' as any)} className="bg-gray-50 px-3 py-1.5 rounded-xl flex-row items-center gap-1.5">
          <History size={12} color="#9CA3AF" />
          <Text className="text-[9px] font-black text-gray-400 uppercase">Historique</Text>
        </Pressable>
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(oilOpen ? null : 'oil')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
            <Droplets size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Huiles de friture</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', oilDoneToday ? 'text-success' : 'text-alert')}>
              {oilDoneToday ? 'Contrôle du jour effectué' : 'Contrôle du jour à faire'}
            </Text>
          </View>
          {oilOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        {oilOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <OilCheckSection embedded />
            </View>
          </View>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(tempOpen ? null : 'temp')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className="w-10 h-10 rounded-xl bg-blue-500/10 items-center justify-center">
            <Thermometer size={18} color="#3B82F6" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Températures frigorifiques</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', tempComplete ? 'text-success' : 'text-alert')}>
              {coldUnits.length === 0
                ? 'Aucune enceinte configurée'
                : `Début ${debutDone}/${coldUnits.length} • Fin ${finDone}/${coldUnits.length}`}
            </Text>
          </View>
          {tempOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        {tempOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <FridgeTempSection />
            </View>
          </View>
        )}
      </View>

    </ScrollView>
  );
}
