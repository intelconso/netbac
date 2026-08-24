import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal } from 'react-native';
import { Check, DownloadCloud, Package, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import CategoryList, { groupKey } from './CategoryList';
import {
  DEFAULT_CATEGORY_COLOR,
  articleCategoryGroups,
  articleCategoryName,
  findArticleByName,
  formatQty,
  isLowStock,
  stockByArticle,
  unitsCompatible,
} from '../lib/inventory';
import { ArticleCategory } from '../types';

// Paramètres → Gestion de stock : le catalogue d'ingrédients de l'inventaire.
// Un article est défini à la granularité où on l'étiquette — "Poulet cru" et
// "Poulet rôti" sont deux articles, parce que ce sont deux choses différentes
// sur l'étagère.
//
// Les articles sont groupés par CATÉGORIE — viandes, sauces, légumes… : on
// ouvre la catégorie qu'on veut au lieu de dérouler tout le catalogue d'un bloc. Le
// classement ne suit plus la structure physique : voir ArticleCategory dans
// types.ts pour le pourquoi.
//
// La quantité affichée est en LECTURE SEULE : en v1 le stock vient uniquement
// des étiquettes. Corriger une quantité se fait donc en corrigeant l'étiquette,
// pas en tapant un chiffre ici — sinon la saisie s'ajouterait à celle des
// étiquettes et compterait deux fois le même stock.
export default function ArticlesManager() {
  const articles = useStore((s) => s.articles);
  const stockMovements = useStore((s) => s.stockMovements);
  const productUnits = useStore((s) => s.productUnits);
  const articleCategories = useStore((s) => s.articleCategories);
  const addArticle = useStore((s) => s.addArticle);
  const updateArticle = useStore((s) => s.updateArticle);
  const deleteArticle = useStore((s) => s.deleteArticle);
  const importArticlesFromProducts = useStore((s) => s.importArticlesFromProducts);

  const live = useMemo(() => (articles ?? []).filter((a) => !a.deletedAt), [articles]);
  const totals = useMemo(() => stockByArticle(live, stockMovements ?? []), [live, stockMovements]);

  const categories = useMemo(
    () => (articleCategories ?? []).filter((c) => !c.deletedAt),
    [articleCategories]
  );
  const groups = useMemo(() => articleCategoryGroups(live, categories), [live, categories]);

  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});

  const [name, setName] = useState('');
  const [unit, setUnit] = useState(productUnits[0] ?? 'kg');
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [minQty, setMinQty] = useState('');
  // Le formulaire d'ajout reste replié : le catalogue est fait pour être lu
  // bien plus souvent qu'alimenté.
  const [adding, setAdding] = useState(false);

  const [editing, setEditing] = useState<{ id: string; name: string; unit: string; categoryId?: string; minQty: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<{ created: number; linked: number } | null>(null);

  const parseMin = (raw: string): number | undefined => {
    const n = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  const closeAdd = () => {
    setAdding(false);
    setName('');
    setCategoryId(undefined);
    setMinQty('');
  };

  // Les doublons se jugent sur le NOM SEUL, partout dans le catalogue — la
  // catégorie n'entre pas dans la comparaison. Un même ingrédient classé deux fois
  // resterait un ingrédient avec un seul total, donc on refuse le doublon.
  //
  // Le store dédoublonne déjà en silence (il rend l'article existant), ce qui est
  // le bon comportement quand on crée une étiquette à la volée, mais illisible
  // ici : le formulaire se viderait sans que rien n'apparaisse. On le dit, et on
  // ouvre la catégorie de l'article existant pour qu'il soit sous les yeux.
  const handleAdd = () => {
    if (!name.trim()) return;
    const clash = findArticleByName(live, name);
    if (clash) {
      setError(`« ${clash.name} » existe déjà — ${articleCategoryName(clash, categories)}.`);
      setOpenKeys((st) => ({ ...st, [clash.categoryId ?? 'none']: true }));
      return;
    }
    setError(null);
    addArticle({ name, unit, categoryId, minQty: parseMin(minQty) });
    setName('');
    setMinQty('');
  };

  const saveEdit = () => {
    if (!editing || !editing.name.trim()) return;
    const res = updateArticle(editing.id, {
      name: editing.name,
      unit: editing.unit,
      categoryId: editing.categoryId,
      minQty: parseMin(editing.minQty),
    });
    if (!res.ok) {
      setError(res.error ?? 'Modification impossible.');
      return;
    }
    setError(null);
    setEditing(null);
  };

  const handleImport = () => {
    setError(null);
    setImported(importArticlesFromProducts());
  };

  return (
    <View className="gap-4">
      <Pressable
        onPress={handleImport}
        className="bg-white p-4 rounded-2xl border-2 border-dashed border-primary/30 flex-row items-center gap-4"
      >
        <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
          <DownloadCloud size={18} color="#10B981" />
        </View>
        <View className="flex-1">
          <Text className="text-xs font-black text-gray-900 uppercase">Importer depuis les étiquettes</Text>
        </View>
      </Pressable>

      {error && (
        <View className="bg-red-50 p-4 rounded-2xl border border-red-200">
          <Text className="text-[11px] font-bold text-red-700">{error}</Text>
        </View>
      )}

      <View className="gap-2">
        <CategoryList
          groups={groups}
          openKeys={openKeys}
          onToggle={(key) => setOpenKeys((st) => ({ ...st, [key]: !st[key] }))}
          renderArticle={(a) => {
            const onHand = totals.get(a.id) ?? 0;
            const low = isLowStock(a, onHand);
            const isEditing = editing?.id === a.id;
            const hasHistory = (stockMovements ?? []).some((m) => m.articleId === a.id && !m.deletedAt);
            return (
              <View className="bg-white p-3 rounded-2xl border border-gray-100 gap-3">
                <View className="flex-row items-center gap-3">
                  <View className={cn('w-10 h-10 rounded-xl items-center justify-center', low ? 'bg-amber-50' : 'bg-primary/10')}>
                    <Package size={16} color={low ? '#F59E0B' : '#10B981'} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>{a.name}</Text>
                    {a.minQty !== undefined && (
                      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5" numberOfLines={1}>
                        Seuil {formatQty(a.minQty, a.unit)}
                      </Text>
                    )}
                  </View>

                  {/* Lecture seule : le stock est celui des étiquettes. */}
                  <View className={cn('px-3 py-2 rounded-xl', low ? 'bg-amber-50' : 'bg-gray-50')}>
                    <Text className="text-sm font-black" style={{ color: low ? '#F59E0B' : '#111827' }}>
                      {formatQty(onHand, a.unit)}
                    </Text>
                  </View>
                  {isEditing ? (
                    <>
                      <Pressable onPress={saveEdit} className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <Check size={14} color="#10B981" />
                      </Pressable>
                      <Pressable onPress={() => { setEditing(null); setError(null); }} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                        <X size={14} color="#9CA3AF" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => {
                          setError(null);
                          setAdding(false);
                          setEditing({
                            id: a.id,
                            name: a.name,
                            unit: a.unit,
                            categoryId: a.categoryId,
                            minQty: a.minQty !== undefined ? String(a.minQty) : '',
                          });
                        }}
                        className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                      >
                        <Pencil size={14} color="#9CA3AF" />
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmDelete({ id: a.id, name: a.name })}
                        className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </Pressable>
                    </>
                  )}
                </View>

                {isEditing && editing && (
                  <View className="gap-2">
                    <TextInput
                      value={editing.name}
                      onChangeText={(v) => setEditing({ ...editing, name: v })}
                      placeholder="Nom de l'article"
                      className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                    />
                    <UnitPicker
                      units={productUnits}
                      value={editing.unit}
                      // Une fois du stock enregistré, seule une unité de la même
                      // famille reste proposée (kg ↔ g) : passer en "pce" rendrait
                      // l'historique en kilos illisible. Le store refuse aussi.
                      isBlocked={(u) => !unitsCompatible(u, a.unit) && hasHistory}
                      onPick={(u) => setEditing({ ...editing, unit: u })}
                    />
                    <CategoryPicker
                      categories={categories}
                      value={editing.categoryId}
                      onPick={(id) => setEditing({ ...editing, categoryId: id })}
                    />
                    <TextInput
                      value={editing.minQty}
                      onChangeText={(v) => setEditing({ ...editing, minQty: v })}
                      placeholder="Seuil d'alerte (optionnel)"
                      keyboardType="decimal-pad"
                      className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                    />
                  </View>
                )}
              </View>
            );
          }}
        />

        {groups.length === 0 && (
          <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-200 items-center gap-2">
            <Package size={20} color="#D1D5DB" />
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
              Aucun article — importez-les ou ajoutez-en un
            </Text>
          </View>
        )}
      </View>

      {/* La confirmation en popup : une suppression se décide sur place, pas en
          cherchant un encart apparu en bas d'une liste qu'on ne voit plus. */}
      <Modal
        visible={!!confirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmDelete(null)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-8 gap-6" style={{ maxWidth: 340 }}>
            <View className="items-center gap-3">
              <View className="w-16 h-16 rounded-full bg-red-50 items-center justify-center">
                <Trash2 size={26} color="#EF4444" />
              </View>
              <Text className="text-sm font-black text-gray-900 uppercase text-center">
                Retirer « {confirmDelete?.name} » ?
              </Text>
              <Text className="text-[11px] font-medium text-gray-500 text-center">
                L'article quitte le catalogue. Son historique de stock est conservé.
              </Text>
            </View>
            <View className="gap-2">
              <Pressable
                onPress={() => {
                  if (confirmDelete) deleteArticle(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="py-4 bg-danger rounded-2xl"
              >
                <Text className="text-xs font-black uppercase text-center text-white">Retirer</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmDelete(null)} className="py-4">
                <Text className="text-xs font-black text-gray-400 uppercase text-center">Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Le résultat de l'import en popup : juste les chiffres, rien d'autre. */}
      <Modal visible={!!imported} transparent animationType="fade" onRequestClose={() => setImported(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center p-6">
          <View className="bg-white w-full rounded-3xl p-8 gap-6" style={{ maxWidth: 340 }}>
            <View className="items-center gap-3">
              <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center">
                <Check size={28} color="#10B981" />
              </View>
              <Text className="text-sm font-black text-gray-900 uppercase text-center">
                {imported?.created ?? 0} article{(imported?.created ?? 0) > 1 ? 's' : ''} créé{(imported?.created ?? 0) > 1 ? 's' : ''}
              </Text>
              <Text className="text-sm font-black text-gray-900 uppercase text-center">
                {imported?.linked ?? 0} étiquette{(imported?.linked ?? 0) > 1 ? 's' : ''} rattachée{(imported?.linked ?? 0) > 1 ? 's' : ''}
              </Text>
            </View>
            <Pressable onPress={() => setImported(null)} className="py-4 bg-gray-900 rounded-2xl">
              <Text className="text-white font-black uppercase text-xs text-center">Fermer</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {adding ? (
        <View className="bg-white p-3 rounded-2xl border-2 border-primary/20 gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-black text-gray-900 uppercase">Nouvel article</Text>
            <Pressable onPress={closeAdd} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
              <X size={14} color="#9CA3AF" />
            </Pressable>
          </View>
          <TextInput
            value={name}
            onChangeText={(v) => { setName(v); if (error) setError(null); }}
            placeholder="Nom de l'article — ex. Poulet cru"
            autoFocus
            className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
          />
          <UnitPicker units={productUnits} value={unit} onPick={setUnit} />
          <CategoryPicker categories={categories} value={categoryId} onPick={setCategoryId} />
          <TextInput
            value={minQty}
            onChangeText={setMinQty}
            placeholder="Seuil d'alerte (optionnel)"
            keyboardType="decimal-pad"
            className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
          />
          <Pressable
            onPress={handleAdd}
            disabled={!name.trim()}
            className={cn('py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2', !name.trim() && 'opacity-40')}
          >
            <Plus size={14} color="#fff" />
            <Text className="text-[10px] font-black text-white uppercase">Ajouter</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          onPress={() => { setAdding(true); setEditing(null); setError(null); }}
          className="bg-primary py-4 rounded-2xl flex-row items-center justify-center gap-2"
        >
          <Plus size={16} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase tracking-widest">Nouvel article</Text>
        </Pressable>
      )}
    </View>
  );
}

// Sélecteur de catégorie. Une seule rangée : la liste est plate, il n'y a rien à
// enchaîner. « Sans catégorie » est un choix explicite, pas un trou — on peut y
// revenir en retapant sur la catégorie déjà sélectionnée.
function CategoryPicker({
  categories,
  value,
  onPick,
}: {
  categories: ArticleCategory[];
  value?: string;
  onPick: (categoryId: string | undefined) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <View className="gap-1">
      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Catégorie</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {categories.map((c) => {
          const active = value === c.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => onPick(active ? undefined : c.id)}
              className={cn(
                'px-3 py-2 rounded-xl flex-row items-center gap-2',
                active ? 'bg-gray-900' : 'bg-gray-50'
              )}
            >
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: c.color ?? DEFAULT_CATEGORY_COLOR }}
              />
              <Text className={cn('font-bold text-xs', active ? 'text-white' : 'text-gray-900')}>
                {c.name}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function UnitPicker({
  units,
  value,
  onPick,
  isBlocked,
}: {
  units: string[];
  value: string;
  onPick: (unit: string) => void;
  isBlocked?: (unit: string) => boolean;
}) {
  return (
    <View className="gap-1">
      <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Unité de stock</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {units.map((u) => {
          const active = value === u;
          const blocked = isBlocked?.(u) ?? false;
          return (
            <Pressable
              key={u}
              disabled={blocked}
              onPress={() => onPick(u)}
              className={cn(
                'px-4 py-2.5 rounded-xl border',
                active ? 'bg-primary border-primary' : 'bg-gray-50 border-gray-100',
                blocked && 'opacity-30'
              )}
            >
              <Text className={cn('font-bold text-xs', active ? 'text-white' : 'text-gray-900')}>{u}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
