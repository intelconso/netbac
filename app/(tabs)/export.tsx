import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert, Switch } from 'react-native';
import { FileText, Download, ShieldCheck, Wifi, WifiOff } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { cn } from '../../src/lib/utils';
import { generateAndShareHaccpPdf } from '../../src/lib/pdf';

export default function ExportScreen() {
  const { isOffline, setOffline } = useStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeTraceability, setIncludeTraceability] = useState(true);
  const [includeExpired, setIncludeExpired] = useState(false);
  const [includeInventory, setIncludeInventory] = useState(false);

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      await generateAndShareHaccpPdf(useStore.getState(), {
        includeTraceability,
        includeExpired,
        includeInventory,
      });
    } catch (err: any) {
      Alert.alert('Export', `Erreur: ${err?.message || 'génération du PDF impossible'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerStyle={{ padding: 24 }} className="flex-1">
        <View className="flex-row items-center gap-4 mb-6">
          <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <FileText size={20} color="#9CA3AF" />
          </View>
          <View>
            <Text className="text-sm font-black text-gray-900 uppercase">Rapports HACCP</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest">Contrôle Sanitaire</Text>
          </View>
        </View>

        <View className="gap-4 mb-8">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">État de la connexion</Text>
          <Pressable
            onPress={() => setOffline(!isOffline)}
            className={cn('p-4 rounded-2xl border-2 flex-row items-center gap-4', isOffline ? 'border-gray-200 bg-gray-50' : 'border-primary/20 bg-primary/5')}
          >
            <View className={cn('w-12 h-12 rounded-full items-center justify-center', isOffline ? 'bg-gray-200' : 'bg-primary/20')}>
              {isOffline ? <WifiOff size={24} color="#6B7280" /> : <Wifi size={24} color="#10B981" />}
            </View>
            <View className="flex-1">
              <Text className="font-bold text-gray-900">{isOffline ? 'Mode Hors-ligne' : 'Mode En ligne'}</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase">
                {isOffline ? 'Sync en attente' : 'Données synchronisées'}
              </Text>
            </View>
            <Switch value={!isOffline} onValueChange={(v) => setOffline(!v)} />
          </Pressable>
        </View>

        <View className="gap-4 mb-8">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Options d'export</Text>
          <View className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <View className="p-4 flex-row items-center justify-between border-b border-gray-50">
              <View className="flex-row items-center gap-3">
                <View className="w-2 h-2 bg-primary rounded-full" />
                <Text className="text-sm font-bold text-gray-700">Traçabilité complète</Text>
              </View>
              <Switch testID="opt-traceability" value={includeTraceability} onValueChange={setIncludeTraceability} />
            </View>
            <View className="p-4 flex-row items-center justify-between border-b border-gray-50">
              <View className="flex-row items-center gap-3">
                <View className="w-2 h-2 bg-danger rounded-full" />
                <Text className="text-sm font-bold text-gray-700">Liste des expirés</Text>
              </View>
              <Switch testID="opt-expired" value={includeExpired} onValueChange={setIncludeExpired} />
            </View>
            <View className="p-4 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="w-2 h-2 bg-blue-500 rounded-full" />
                <Text className="text-sm font-bold text-gray-700">Inventaire actuel</Text>
              </View>
              <Switch testID="opt-inventory" value={includeInventory} onValueChange={setIncludeInventory} />
            </View>
          </View>
        </View>

        <View className="bg-success/5 border border-success/10 p-4 rounded-2xl flex-row items-start gap-3">
          <ShieldCheck size={20} color="#10B981" />
          <View className="gap-1 flex-1">
            <Text className="text-xs font-bold text-success uppercase">Conformité HACCP</Text>
            <Text className="text-[10px] text-success/70 font-medium">
              Les exports générés incluent un horodatage local et un hash d'intégrité pour garantir l'authenticité.
            </Text>
          </View>
        </View>
      </ScrollView>

      <View className="p-6 bg-white border-t border-gray-100 gap-3">
        <Pressable
          testID="generate-pdf"
          onPress={generatePDF}
          disabled={isGenerating}
          className={cn('py-4 rounded-2xl flex-row items-center justify-center gap-2', isGenerating ? 'bg-gray-100' : 'bg-primary')}
        >
          {isGenerating ? (
            <Text className="text-gray-400 font-bold">Génération en cours...</Text>
          ) : (
            <>
              <Download size={20} color="#fff" />
              <Text className="text-white font-bold">GÉNÉRER LE PDF</Text>
            </>
          )}
        </Pressable>
        <Text className="text-[10px] text-center font-bold text-gray-400 uppercase tracking-widest">
          0 connexion requise pour l'export
        </Text>
      </View>
    </View>
  );
}
