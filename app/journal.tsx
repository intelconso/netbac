import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, History, Calendar, Thermometer, Sparkles, Clock, User, ChevronRight, CheckCircle2, AlertCircle, ShieldCheck,
} from 'lucide-react-native';
import { useStore } from '../src/lib/store';
import { formatDate, cn } from '../src/lib/utils';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function JournalScreen() {
  const router = useRouter();
  const { logs, tempLogs, cleaningTasks, storageUnits, completeCleaningTask, addTempLog, user } = useStore();
  const [activeTab, setActiveTab] = useState<'history' | 'calendar' | 'haccp'>('haccp');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'actions' | 'products'>('all');
  const [isAddingTemp, setIsAddingTemp] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(storageUnits[0]?.id || '');
  const [tempValue, setTempValue] = useState('4');

  const handleAddTemp = () => {
    addTempLog({
      unitId: selectedUnitId,
      temperature: parseFloat(tempValue),
      operatorId: user?.id || 'admin',
      operatorName: user?.name || 'Admin',
      status: parseFloat(tempValue) <= 4 ? 'ok' : 'alert',
    });
    setIsAddingTemp(false);
  };

  const tabs = [
    { id: 'haccp', label: 'HACCP', icon: ShieldCheck, enabled: user?.settings?.enableTemperature || user?.settings?.enableCleaning },
    { id: 'history', label: 'Journal', icon: History, enabled: true },
    { id: 'calendar', label: 'Planning', icon: Calendar, enabled: true },
  ].filter((t) => t.enabled);

  const filteredLogs = logs.filter((log) => {
    if (log.action === 'temp_check' && !user?.settings?.enableTemperature) return false;
    if (log.action === 'cleaning' && !user?.settings?.enableCleaning) return false;
    if (historyFilter === 'actions') return ['temp_check', 'cleaning'].includes(log.action);
    if (historyFilter === 'products') return ['add_product', 'use_product', 'discard_product'].includes(log.action);
    return true;
  });

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center gap-4 bg-white border-b border-gray-50">
        <Pressable onPress={() => router.back()} className="p-2 -ml-2"><ArrowLeft size={20} color="#9CA3AF" /></Pressable>
        <View>
          <Text className="text-sm font-black text-gray-900 uppercase">Journal de Bord</Text>
          <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">Historique & HACCP</Text>
        </View>
      </View>

      <View className="flex-row p-1 bg-gray-100 mx-6 mt-6 rounded-2xl">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <Pressable key={tab.id} onPress={() => setActiveTab(tab.id as any)} className={cn('flex-1 py-3 rounded-xl items-center gap-1', active ? 'bg-white' : '')}>
              <Icon size={16} color={active ? '#10B981' : '#9CA3AF'} />
              <Text className={cn('text-[9px] font-black uppercase tracking-widest', active ? 'text-primary' : 'text-gray-400')}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, gap: 32 }}>
        {activeTab === 'history' && (
          <>
            <View className="flex-row gap-2 p-1 bg-gray-100 rounded-xl">
              {(['all', 'actions', 'products'] as const).map((f) => (
                <Pressable key={f} onPress={() => setHistoryFilter(f)} className={cn('flex-1 py-2 rounded-lg', historyFilter === f ? 'bg-white' : '')}>
                  <Text className={cn('text-[9px] font-black uppercase text-center', historyFilter === f ? 'text-gray-900' : 'text-gray-400')}>
                    {f === 'all' ? 'Tout' : f === 'actions' ? 'HACCP' : 'Produits'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="gap-4">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Flux</Text>
              {filteredLogs.map((log) => (
                <View key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row gap-4">
                  <View className={cn(
                    'w-10 h-10 rounded-xl items-center justify-center',
                    log.action === 'add_product' ? 'bg-success/10' :
                      log.action === 'temp_check' ? 'bg-primary/10' :
                      log.action === 'cleaning' ? 'bg-blue-500/10' : 'bg-gray-100'
                  )}>
                    {log.action === 'add_product' ? <CheckCircle2 size={18} color="#10B981" />
                      : log.action === 'temp_check' ? <Thermometer size={18} color="#10B981" />
                      : log.action === 'cleaning' ? <Sparkles size={18} color="#3B82F6" />
                      : <Clock size={18} color="#9CA3AF" />}
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row justify-between">
                      <Text className="text-xs font-black text-gray-900 uppercase flex-1">{log.details}</Text>
                      <Text className="text-[8px] font-bold text-gray-400 uppercase">{formatDate(log.timestamp)}</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                      <User size={10} color="#9CA3AF" />
                      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{log.userName}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {filteredLogs.length === 0 && (
                <View className="py-12 items-center">
                  <Text className="text-xs font-bold uppercase text-gray-400">Aucun log</Text>
                </View>
              )}
            </View>
          </>
        )}

        {activeTab === 'calendar' && (
          <>
            <View className="bg-gray-900 rounded-3xl p-6 gap-6">
              <View>
                <Text className="text-xl font-black uppercase text-white">Vue Mensuelle</Text>
                <Text className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Avril 2026</Text>
              </View>
              <View className="flex-row flex-wrap">
                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                  <View key={i} className="items-center justify-center" style={{ width: '14.28%' }}>
                    <Text className="text-[8px] font-black text-white/20">{d}</Text>
                  </View>
                ))}
                {Array.from({ length: 30 }).map((_, i) => {
                  const isToday = i + 1 === 18;
                  return (
                    <View key={i} className="items-center justify-center p-1" style={{ width: '14.28%' }}>
                      <View className={cn('aspect-square w-full rounded-lg items-center justify-center border border-white/5', isToday ? 'bg-primary' : '')}>
                        <Text className={cn('text-[10px] font-black', isToday ? 'text-white' : 'text-white/40')}>{i + 1}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View className="gap-4">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Événements</Text>
              <View className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-danger/10 items-center justify-center">
                    <AlertCircle size={18} color="#EF4444" />
                  </View>
                  <View>
                    <Text className="text-xs font-black text-gray-900 uppercase">DLC: Poulet</Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase">10 Avril</Text>
                  </View>
                </View>
                <ChevronRight size={16} color="#D1D5DB" />
              </View>
            </View>
          </>
        )}

        {activeTab === 'haccp' && (
          <>
            {user?.settings?.enableTemperature && (
              <View className="gap-4">
                <View className="flex-row justify-between items-center">
                  <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Températures</Text>
                  <Pressable onPress={() => setIsAddingTemp(true)} className="flex-row items-center gap-1">
                    <Thermometer size={12} color="#10B981" />
                    <Text className="text-[10px] font-black text-primary uppercase">Nouveau</Text>
                  </Pressable>
                </View>

                {isAddingTemp && (
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
                      <Pressable onPress={() => setIsAddingTemp(false)} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
                      <Pressable onPress={handleAddTemp} className="flex-1 py-3 bg-primary rounded-xl"><Text className="text-[10px] font-black uppercase text-center text-white">Enregistrer</Text></Pressable>
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
            )}

            {user?.settings?.enableCleaning && (
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
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
