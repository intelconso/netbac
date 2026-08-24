import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronRight, Package, Search, TriangleAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../../src/lib/useActive';
import { cn } from '../../src/lib/utils';
import CategoryList from '../../src/components/CategoryList';
import {
  articleCategoryGroups,
  formatQty,
  isLowStock,
  normalizeArticleName,
  stockByArticle,
} from '../../src/lib/inventory';

// Inventaire — l'état du stock, groupé par catégorie d'articles.
//
// La liste n'est jamais déroulée d'un bloc : on ouvre la catégorie qu'on veut. Un
// article a UNE quantité, celle du registre.
//
// Le classement est par catégorie et non par emplacement : une catégorie est
// intrinsèque à l'ingrédient, un emplacement ne l'est pas (voir ArticleCategory
// dans types.ts).
export default function InventoryScreen() {
  const router = useRouter();
  const { articles, stockMovements, articleCategories } = useActiveStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const [lowOnly, setLowOnly] = useState(false);

  const totals = useMemo(() => stockByArticle(articles, stockMovements), [articles, stockMovements]);

  const lowCount = useMemo(
    () => articles.filter((a) => isLowStock(a, totals.get(a.id) ?? 0)).length,
    [articles, totals]
  );

  const query = normalizeArticleName(searchTerm);

  // Le filtre s'applique aux articles ; les groupes sont construits ensuite,
  // donc une catégorie dont plus rien ne passe le filtre disparaît d'elle-même.
  const groups = useMemo(() => {
    const visible = articles.filter((a) => {
      if (query && !normalizeArticleName(a.name).includes(query)) return false;
      if (lowOnly && !isLowStock(a, totals.get(a.id) ?? 0)) return false;
      return true;
    });
    return articleCategoryGroups(visible, articleCategories);
  }, [articles, articleCategories, query, lowOnly, totals]);

  // Une recherche ou un filtre ouvre tout : masquer un résultat derrière une
  // section repliée reviendrait à dire qu'il n'existe pas.
  const forceOpen = !!query || lowOnly;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50 gap-4">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 uppercase">Inventaire</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
              {articles.length} article{articles.length > 1 ? 's' : ''} suivi{articles.length > 1 ? 's' : ''}
              {lowCount > 0 ? ` · ${lowCount} sous le seuil` : ''}
            </Text>
          </View>
        </View>

        <View className="relative">
          <View className="absolute left-4 top-3.5 z-10"><Search size={16} color="#9CA3AF" /></View>
          <TextInput
            placeholder="Rechercher un article..." value={searchTerm} onChangeText={setSearchTerm}
            className="pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold"
          />
        </View>

        {lowCount > 0 && (
          <Pressable
            onPress={() => setLowOnly((v) => !v)}
            className={cn('self-start px-4 py-2 rounded-xl flex-row items-center gap-2', lowOnly ? 'bg-alert' : 'bg-gray-50')}
          >
            <TriangleAlert size={12} color={lowOnly ? '#fff' : '#9CA3AF'} />
            <Text className={cn('text-[9px] font-black uppercase tracking-widest', lowOnly ? 'text-white' : 'text-gray-400')}>
              Sous le seuil · {lowCount}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 10 }}>
        <CategoryList
          groups={groups}
          openKeys={openKeys}
          // Plusieurs catégories peuvent rester ouvertes : la liste est plate, on
          // ne perd pas le fil en gardant deux sections dépliées.
          onToggle={(key) => setOpenKeys((st) => ({ ...st, [key]: !st[key] }))}
          forceOpen={forceOpen}
          renderArticle={(article) => {
            const onHand = totals.get(article.id) ?? 0;
            const low = isLowStock(article, onHand);
            // La rupture se distingue du simple « sous le seuil » : il ne reste
            // rien du tout, ce n'est plus « à recommander » mais « il en faut ».
            const out = onHand <= 0;
            const accent = out ? '#EF4444' : low ? '#F59E0B' : '#10B981';
            return (
              <Pressable
                onPress={() => router.push(`/inventory/${article.id}` as any)}
                className="bg-white p-3 rounded-xl border border-gray-100 flex-row items-center gap-3 active:bg-gray-50"
              >
                <View className="w-1 h-10 rounded-full" style={{ backgroundColor: accent }} />
                <View className="flex-1">
                  <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{article.name}</Text>
                  <Text
                    className="text-[10px] font-bold uppercase tracking-widest mt-0.5"
                    style={{ color: out || low ? accent : '#9CA3AF' }}
                    numberOfLines={1}
                  >
                    {out
                      ? 'En rupture'
                      : low
                        ? `À recommander · seuil ${formatQty(article.minQty!, article.unit)}`
                        : article.minQty !== undefined
                          ? `Seuil ${formatQty(article.minQty, article.unit)}`
                          : 'Aucun seuil'}
                  </Text>
                </View>
                <Text className="text-sm font-black uppercase" style={{ color: out || low ? accent : '#111827' }}>
                  {formatQty(onHand, article.unit)}
                </Text>
                <ChevronRight size={16} color="#D1D5DB" />
              </Pressable>
            );
          }}
        />

        {groups.length === 0 && (
          <View className="py-20 items-center gap-3 px-8">
            <Package size={24} color="#D1D5DB" />
            <Text className="text-sm text-gray-400 font-medium text-center">
              {articles.length === 0 ? "Aucun article suivi pour l'instant." : 'Aucun article ne correspond.'}
            </Text>
            {articles.length === 0 && (
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Paramètres → Gestion de stock
              </Text>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
