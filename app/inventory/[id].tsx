import React, { useMemo } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Package, Tag, TriangleAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useActiveStore } from '../../src/lib/useActive';
import { cn } from '../../src/lib/utils';
import {
  MOVEMENT_LABELS,
  formatQty,
  isLowStock,
  articleCategoryName,
  movementsForArticle,
  signedQty,
  stockOnHand,
} from '../../src/lib/inventory';
import { StockMovementKind } from '../../src/types';

const KIND_COLORS: Record<StockMovementKind, string> = {
  in: '#10B981',
  out_used: '#6B7280',
  out_waste: '#EF4444',
  adjust: '#3B82F6',
};

// Fiche article — le stock actuel et tout ce qui l'a fait bouger.
//
// V1 : le stock vient UNIQUEMENT des étiquettes. Aucune saisie manuelle ici.
// La raison est le but même de la fonctionnalité — savoir ce qui manque. Une
// quantité tapée à la main n'apprend rien : il a fallu regarder l'étagère pour
// la saisir, donc on savait déjà. Pire, elle s'ajoutait à celle des étiquettes
// et faisait compter deux fois le même stock.
//
// L'écran est en LECTURE SEULE de bout en bout. Une ligne de mouvement nomme
// l'étiquette qui l'a produite mais ne l'ouvre pas : passer par l'historique
// comptable pour tomber dans l'éditeur complet d'une étiquette (nom, DLC,
// photo, bac…) était la seule porte d'édition d'étiquette de toute
// l'application, et elle ne se découvrait qu'en tapant une ligne d'historique.
// (Les actions manuelles restent dans le store, sans écran — voir
// addStockMovement / setStockCount.)
export default function ArticleDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { articles, stockMovements, products, articleCategories } = useActiveStore();

  const article = articles.find((a) => a.id === id);
  const onHand = useMemo(
    () => (article ? stockOnHand(article.id, articles, stockMovements) : 0),
    [article, articles, stockMovements]
  );
  const movements = useMemo(
    () => (article ? movementsForArticle(article.id, stockMovements) : []),
    [article, stockMovements]
  );

  if (!article) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center gap-4 p-8">
        <Package size={24} color="#D1D5DB" />
        <Text className="text-sm text-gray-400 font-medium text-center">Article introuvable.</Text>
        <Pressable onPress={() => router.back()} className="bg-gray-900 px-6 py-3 rounded-2xl">
          <Text className="text-white font-black uppercase text-xs">Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const low = isLowStock(article, onHand);

  return (
    <SafeAreaView className="flex-1 bg-background">
        <View className="px-6 py-4 bg-white border-b border-gray-50 flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{article.name}</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
              {articleCategoryName(article, articleCategories)}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          <View className={cn('rounded-3xl p-6 gap-1 items-center', low ? 'bg-alert' : 'bg-white border border-gray-100')}>
            <Text className={cn('text-[9px] font-bold uppercase tracking-widest', low ? 'text-white/70' : 'text-gray-400')}>
              Stock actuel
            </Text>
            <Text className={cn('text-4xl font-black', low ? 'text-white' : 'text-gray-900')}>
              {formatQty(onHand, article.unit)}
            </Text>
            {article.minQty !== undefined && (
              <Text className={cn('text-[9px] font-bold uppercase tracking-widest', low ? 'text-white/70' : 'text-gray-400')}>
                Seuil d'alerte · {formatQty(article.minQty, article.unit)}
              </Text>
            )}
            {low && (
              <View className="flex-row items-center gap-1.5 mt-2">
                <TriangleAlert size={12} color="#fff" />
                <Text className="text-[10px] font-black text-white uppercase tracking-widest">
                  {onHand <= 0 ? 'En rupture' : 'À recommander'}
                </Text>
              </View>
            )}
            {/* Sans seuil, un article n'alerte jamais — on le dit plutôt que de
                laisser croire que « 0 » a été jugé acceptable. */}
            {article.minQty === undefined && (
              <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-2 text-center">
                Aucun seuil réglé · cet article n'alerte pas
              </Text>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mouvements</Text>
            {movements.map((m) => {
              const delta = signedQty(m);
              const color = KIND_COLORS[m.kind];
              const label = products.find((p) => p.id === m.productId);
              return (
                <View
                  key={m.id}
                  className="bg-white p-3 rounded-xl border border-gray-100 flex-row items-center gap-3"
                >
                  <View className="w-1 h-10 rounded-full" style={{ backgroundColor: color }} />
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-xs font-black uppercase" style={{ color }}>{MOVEMENT_LABELS[m.kind]}</Text>
                      {!!m.productId && <Tag size={10} color="#D1D5DB" />}
                    </View>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" numberOfLines={1}>
                      {format(new Date(m.timestamp), 'd MMM yyyy · HH:mm', { locale: fr })}
                      {m.operatorName ? ` · ${m.operatorName}` : ''}
                      {label ? ` · ${label.name}` : ''}
                    </Text>
                    {!!m.notes && (
                      <Text className="text-[10px] font-medium text-gray-500 mt-0.5" numberOfLines={2}>{m.notes}</Text>
                    )}
                  </View>
                  <Text className="text-sm font-black" style={{ color }}>
                    {delta > 0 ? '+' : ''}{formatQty(delta, m.unit)}
                  </Text>
                </View>
              );
            })}

            {movements.length === 0 && (
              <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
                <Package size={20} color="#D1D5DB" />
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                  Aucun mouvement — créez une étiquette pour cet article
                </Text>
              </View>
            )}
          </View>
      </ScrollView>
    </SafeAreaView>
  );
}
