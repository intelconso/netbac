import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { ChefHat, ChevronDown, ChevronRight, Droplets, History, MessageSquare, Sparkles, Thermometer, Truck } from 'lucide-react-native';
import { useActiveStore } from '../../src/lib/useActive';
import { cn } from '../../src/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import OilCheckSection from '../../src/components/controls/OilCheckSection';
import FridgeTempSection from '../../src/components/controls/FridgeTempSection';
import FabricationSection from '../../src/components/controls/FabricationSection';
import CleaningCheckSection from '../../src/components/controls/CleaningCheckSection';
import ReceptionSection from '../../src/components/controls/ReceptionSection';
import DailyRemarkSection from '../../src/components/controls/DailyRemarkSection';
import { isColdUnit } from '../../src/lib/fridgeTemp';
import { dayStatus } from '../../src/lib/serviceDays';

// Icône de carte qui se colore avec l'avancement du contrôle : ambre tant que
// rien n'est fait, vert une fois complet. Entre les deux, la barre de
// progression sous la carte montre l'avancement.
function progressTint(progress: number): { bg: string; color: string } {
  if (progress >= 1) return { bg: 'bg-success/10', color: '#10B981' };
  return { bg: 'bg-alert/10', color: '#F59E0B' };
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View className="h-1 bg-gray-100">
      <View className="h-1 bg-success rounded-r-full" style={{ width: `${Math.round(progress * 100)}%` }} />
    </View>
  );
}

// Hub des contrôles HACCP du registre papier. Chaque page du registre devient
// un contrôle ici : un composant src/components/controls/*Section.tsx branché
// sur sa carte.
export default function TracabiliteScreen() {
  const router = useRouter();
  const { oilChecks, fridgeTempChecks, fabrications, cleaningChecks, cleaningAreas, receptions, dailyRemarks, storageUnits, closedWeekdays, singleServiceWeekdays, dayOverrides } = useActiveStore();
  const [openId, setOpenId] = useState<string | null>('oil');

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const schedule = { closedWeekdays, singleServiceWeekdays, dayOverrides };
  const todayStatus = dayStatus(startOfToday, schedule);
  // Jour fermé : aucun contrôle attendu. Service unique : un seul relevé de
  // température par enceinte (huiles/nettoyage restent attendus comme un jour ouvert).
  const closedToday = todayStatus === 'closed';
  const singleToday = todayStatus === 'single';
  const NEUTRAL_TINT = { bg: 'bg-gray-100', color: '#9CA3AF' };
  const oilDoneToday = oilChecks.some((c) => c.timestamp >= startOfToday);
  const oilOpen = openId === 'oil';

  const coldUnits = storageUnits.filter((u) => isColdUnit(u.type));
  const todayTemp = fridgeTempChecks.filter((c) => c.timestamp >= startOfToday);
  const tempDone = (svc: 'debut' | 'fin') => coldUnits.filter((u) => todayTemp.some((c) => c.unitId === u.id && c.service === svc)).length;
  const debutDone = tempDone('debut');
  const finDone = tempDone('fin');
  // Service unique : une enceinte est "relevée" dès qu'elle a au moins un relevé.
  const unitsRelevés = coldUnits.filter((u) => todayTemp.some((c) => c.unitId === u.id)).length;
  const tempComplete = coldUnits.length > 0 && (singleToday
    ? unitsRelevés === coldUnits.length
    : debutDone === coldUnits.length && finDone === coldUnits.length);
  const tempOpen = openId === 'temp';

  const fabToday = fabrications.filter((f) => f.timestamp >= startOfToday).length;
  const fabOpen = openId === 'fab';

  const recToday = receptions.filter((r) => r.timestamp >= startOfToday);
  const recIssues = recToday.filter((r) => r.result === 'non_conforme').length;
  const recOpen = openId === 'rec';

  const remarksToday = dailyRemarks.filter((r) => r.timestamp >= startOfToday).length;
  const remarksOpen = openId === 'remarks';

  const cleaningDone = cleaningAreas.filter((a) =>
    cleaningChecks.some((c) => c.area === a && c.timestamp >= startOfToday)
  ).length;
  const cleaningProgress = cleaningAreas.length > 0 ? cleaningDone / cleaningAreas.length : 0;
  const cleaningOpen = openId === 'cleaning';
  const cleaningClosed = closedToday && cleaningProgress < 1;
  const cleaningTint = cleaningClosed ? NEUTRAL_TINT : progressTint(cleaningProgress);

  const oilProgress = oilDoneToday ? 1 : 0;
  const tempProgress = coldUnits.length === 0
    ? 0
    : singleToday
    ? unitsRelevés / coldUnits.length
    : (debutDone + finDone) / (2 * coldUnits.length);
  const oilClosed = closedToday && !oilDoneToday;
  const tempClosed = closedToday && !tempComplete;
  const oilTint = oilClosed ? NEUTRAL_TINT : progressTint(oilProgress);

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

      {closedToday && (
        <View className="bg-gray-100 p-3 rounded-2xl">
          <Text className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">
            Service fermé aujourd'hui — contrôles non requis
          </Text>
        </View>
      )}
      {singleToday && (
        <View className="bg-blue-500/10 p-3 rounded-2xl">
          <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">
            Service unique aujourd'hui — un relevé de température par enceinte
          </Text>
        </View>
      )}

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(oilOpen ? null : 'oil')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', oilTint.bg)}>
            <Droplets size={18} color={oilTint.color} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Huiles de friture</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', oilDoneToday ? 'text-success' : oilClosed ? 'text-gray-400' : 'text-alert')}>
              {oilDoneToday ? 'Contrôle du jour effectué' : oilClosed ? 'Service fermé' : 'Contrôle du jour à faire'}
            </Text>
          </View>
          {oilOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        <ProgressBar progress={oilProgress} />
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
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', tempComplete ? 'text-success' : tempClosed ? 'text-gray-400' : 'text-alert')}>
              {coldUnits.length === 0
                ? 'Aucune enceinte configurée'
                : tempClosed
                ? 'Service fermé'
                : singleToday
                ? `${unitsRelevés}/${coldUnits.length} enceinte${coldUnits.length > 1 ? 's' : ''} relevée${unitsRelevés > 1 ? 's' : ''}`
                : `Début ${debutDone}/${coldUnits.length} • Fin ${finDone}/${coldUnits.length}`}
            </Text>
          </View>
          {tempOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        <ProgressBar progress={tempProgress} />
        {tempOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <FridgeTempSection />
            </View>
          </View>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(cleaningOpen ? null : 'cleaning')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', cleaningTint.bg)}>
            <Sparkles size={18} color={cleaningTint.color} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Contrôles nettoyage</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', cleaningProgress >= 1 ? 'text-success' : cleaningClosed ? 'text-gray-400' : 'text-alert')}>
              {cleaningClosed
                ? 'Service fermé'
                : `${cleaningDone}/${cleaningAreas.length} zone${cleaningAreas.length > 1 ? 's' : ''} contrôlée${cleaningDone > 1 ? 's' : ''}`}
            </Text>
          </View>
          {cleaningOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        <ProgressBar progress={cleaningProgress} />
        {cleaningOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <CleaningCheckSection />
            </View>
          </View>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(fabOpen ? null : 'fab')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', fabToday > 0 ? 'bg-success/10' : 'bg-gray-100')}>
            <ChefHat size={18} color={fabToday > 0 ? '#10B981' : '#9CA3AF'} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Fabrications du jour</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', fabToday > 0 ? 'text-success' : 'text-gray-400')}>
              {fabToday > 0 ? `${fabToday} aujourd'hui` : 'Aucune aujourd’hui'}
            </Text>
          </View>
          {fabOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        {fabOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <FabricationSection />
            </View>
          </View>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(recOpen ? null : 'rec')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', recIssues > 0 ? 'bg-danger/10' : recToday.length > 0 ? 'bg-success/10' : 'bg-gray-100')}>
            <Truck size={18} color={recIssues > 0 ? '#EF4444' : recToday.length > 0 ? '#10B981' : '#9CA3AF'} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Réceptions du jour</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', recIssues > 0 ? 'text-danger' : recToday.length > 0 ? 'text-success' : 'text-gray-400')}>
              {recToday.length === 0
                ? 'Aucune aujourd’hui'
                : `${recToday.length} aujourd'hui${recIssues > 0 ? ` • ${recIssues} non conforme${recIssues > 1 ? 's' : ''}` : ''}`}
            </Text>
          </View>
          {recOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        {recOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <ReceptionSection />
            </View>
          </View>
        )}
      </View>

      <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <Pressable onPress={() => setOpenId(remarksOpen ? null : 'remarks')} className="p-4 flex-row items-center gap-4 active:bg-gray-50">
          <View className={cn('w-10 h-10 rounded-xl items-center justify-center', remarksToday > 0 ? 'bg-success/10' : 'bg-gray-100')}>
            <MessageSquare size={18} color={remarksToday > 0 ? '#10B981' : '#9CA3AF'} />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Remarques du jour</Text>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest mt-0.5', remarksToday > 0 ? 'text-success' : 'text-gray-400')}>
              {remarksToday > 0 ? `${remarksToday} aujourd'hui` : 'Aucune aujourd’hui'}
            </Text>
          </View>
          {remarksOpen ? <ChevronDown size={16} color="#9CA3AF" /> : <ChevronRight size={16} color="#9CA3AF" />}
        </Pressable>
        {remarksOpen && (
          <View className="p-4 pt-0 border-t border-gray-50">
            <View className="pt-4">
              <DailyRemarkSection />
            </View>
          </View>
        )}
      </View>

      {/* Plats témoins (restauration collective uniquement) : masqué pour
          l'instant — WitnessSampleSection et sa couche données restent prêts
          à être rebranchés ici. */}

    </ScrollView>
  );
}
