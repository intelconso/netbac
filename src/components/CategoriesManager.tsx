import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, Modal } from 'react-native';
import { Check, ChevronDown, ChevronRight, Plus, RotateCcw, Tag, Trash2, X } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { DEFAULT_ARTICLE_CATEGORIES, DEFAULT_CATEGORY_COLOR } from '../lib/inventory';

// Les couleurs proposées à la création d'une catégorie. Une pastille suffit à
// distinguer les sections d'un coup d'œil ; on ne demande pas un code hexa.
const PALETTE = [
  '#EF4444', '#F59E0B', '#FBBF24', '#10B981',
  '#0EA5E9', '#38BDF8', '#8B5CF6', '#EC4899',
  '#A16207', '#6B7280',
];

// Gestion des catégories d'articles — Paramètres → Personnalisation.
//
// Supprimer une catégorie ne touche AUCUN article : ils retombent dans « Sans
// catégorie » à l'affichage, donc la restaurer les y ramène tous d'un coup
// (voir articleCategoryGroups).
//
// `alwaysOpen` quand le composant EST l'écran : l'en-tête repliable n'a de sens
// qu'imbriqué dans une page qui contient autre chose.
export default function CategoriesManager({ alwaysOpen = false }: { alwaysOpen?: boolean } = {}) {
  const articleCategories = useStore((s) => s.articleCategories);
  const articles = useStore((s) => s.articles);
  const addArticleCategory = useStore((s) => s.addArticleCategory);
  const updateArticleCategory = useStore((s) => s.updateArticleCategory);
  const deleteArticleCategory = useStore((s) => s.deleteArticleCategory);
  const restoreDefaultArticleCategories = useStore((s) => s.restoreDefaultArticleCategories);

  const categories = useMemo(
    () => (articleCategories ?? []).filter((c) => !c.deletedAt),
    [articleCategories]
  );

  // Combien d'articles chaque catégorie contient — c'est ce qu'on perd de vue
  // en la supprimant, donc c'est ce qu'on affiche avant de confirmer.
  const counts = useMemo(() => {
    const out = new Map<string, number>();
    for (const a of articles ?? []) {
      if (a.deletedAt || !a.categoryId) continue;
      out.set(a.categoryId, (out.get(a.categoryId) ?? 0) + 1);
    }
    return out;
  }, [articles]);

  const [collapsed, setCollapsed] = useState(true);
  const open = alwaysOpen || !collapsed;
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(PALETTE[0]);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Catégories d'origine actuellement absentes — le bouton de restauration
  // n'apparaît que s'il a quelque chose à faire.
  const missingDefaults = useMemo(
    () => DEFAULT_ARTICLE_CATEGORIES.filter((d) => !categories.some((c) => c.id === d.id)).length,
    [categories]
  );

  const handleAdd = () => {
    const res = addArticleCategory({ name, color });
    if (!res.ok) {
      setError(res.error ?? 'Ajout impossible.');
      return;
    }
    setError(null);
    setName('');
    setAdding(false);
  };

  const saveEdit = () => {
    if (!editing) return;
    const res = updateArticleCategory(editing.id, { name: editing.name, color: editing.color });
    if (!res.ok) {
      setError(res.error ?? 'Modification impossible.');
      return;
    }
    setError(null);
    setEditing(null);
  };

  // Ce que la suppression déplace — lu dans le modal, donc calculé ici plutôt
  // qu'au milieu du JSX.
  const deletingCount = confirmDelete ? counts.get(confirmDelete.id) ?? 0 : 0;

  const ColorRow = ({ value, onPick }: { value: string; onPick: (c: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {PALETTE.map((c) => (
        <Pressable
          key={c}
          onPress={() => onPick(c)}
          className={cn(
            'w-8 h-8 rounded-full items-center justify-center',
            value === c && 'border-2 border-gray-900'
          )}
          style={{ backgroundColor: c }}
        >
          {value === c && <Check size={12} color="#fff" />}
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <View className="gap-2">
      {!alwaysOpen && (
        <Pressable
          onPress={() => setCollapsed((v) => !v)}
          className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-3 active:bg-gray-50"
        >
          <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <Tag size={16} color="#9CA3AF" />
          </View>
          <View className="flex-1">
            <Text className="text-xs font-black text-gray-900 uppercase">Catégories</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
              {categories.length} catégorie{categories.length > 1 ? 's' : ''}
            </Text>
          </View>
          {open ? <ChevronDown size={16} color="#D1D5DB" /> : <ChevronRight size={16} color="#D1D5DB" />}
        </Pressable>
      )}

      {open && (
        <View className="gap-2">
          {error && (
            <View className="bg-red-50 p-4 rounded-2xl border border-red-200">
              <Text className="text-[11px] font-bold text-red-700">{error}</Text>
            </View>
          )}

          {categories.map((c) => {
            const isEditing = editing?.id === c.id;
            const count = counts.get(c.id) ?? 0;
            return (
              <View key={c.id} className="bg-white p-3 rounded-2xl border border-gray-100 gap-3">
                <View className="flex-row items-center gap-3">
                  <View
                    className="w-8 h-8 rounded-xl"
                    style={{ backgroundColor: c.color ?? DEFAULT_CATEGORY_COLOR }}
                  />
                  <View className="flex-1">
                    <Text className="text-sm font-black text-gray-900 uppercase" numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                      {count} article{count > 1 ? 's' : ''}
                    </Text>
                  </View>
                  {isEditing ? (
                    <>
                      <Pressable onPress={saveEdit} className="w-9 h-9 rounded-xl bg-primary/10 items-center justify-center">
                        <Check size={14} color="#10B981" />
                      </Pressable>
                      <Pressable
                        onPress={() => { setEditing(null); setError(null); }}
                        className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                      >
                        <X size={14} color="#9CA3AF" />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <Pressable
                        onPress={() => {
                          setError(null);
                          setAdding(false);
                          setEditing({ id: c.id, name: c.name, color: c.color ?? DEFAULT_CATEGORY_COLOR });
                        }}
                        className="px-3 py-2 rounded-xl bg-gray-50"
                      >
                        <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest">
                          Modifier
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setConfirmDelete({ id: c.id, name: c.name })}
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
                      placeholder="Nom de la catégorie"
                      className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
                    />
                    <ColorRow value={editing.color} onPick={(col) => setEditing({ ...editing, color: col })} />
                  </View>
                )}
              </View>
            );
          })}


          {adding ? (
            <View className="bg-white p-3 rounded-2xl border-2 border-primary/20 gap-3">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-black text-gray-900 uppercase">Nouvelle catégorie</Text>
                <Pressable
                  onPress={() => { setAdding(false); setName(''); setError(null); }}
                  className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                >
                  <X size={14} color="#9CA3AF" />
                </Pressable>
              </View>
              <TextInput
                value={name}
                onChangeText={(v) => { setName(v); if (error) setError(null); }}
                placeholder="Nom de la catégorie — ex. Viandes"
                autoFocus
                className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
              />
              <ColorRow value={color} onPick={setColor} />
              <Pressable
                onPress={handleAdd}
                disabled={!name.trim()}
                className={cn(
                  'py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2',
                  !name.trim() && 'opacity-40'
                )}
              >
                <Plus size={14} color="#fff" />
                <Text className="text-[10px] font-black text-white uppercase">Ajouter</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { setAdding(true); setEditing(null); setError(null); }}
              className="bg-gray-900 py-4 rounded-2xl flex-row items-center justify-center gap-2"
            >
              <Plus size={16} color="#fff" />
              <Text className="text-[10px] font-black text-white uppercase tracking-widest">
                Nouvelle catégorie
              </Text>
            </Pressable>
          )}

          {missingDefaults > 0 && (
            <Pressable
              onPress={() => { setError(null); restoreDefaultArticleCategories(); }}
              className="bg-white p-4 rounded-2xl border-2 border-dashed border-gray-200 flex-row items-center gap-4"
            >
              <View className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                <RotateCcw size={16} color="#9CA3AF" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-gray-900 uppercase">
                  Remettre les {missingDefaults} catégorie{missingDefaults > 1 ? 's' : ''} d'origine
                </Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                  Les catégories ajoutées à la main sont conservées
                </Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

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
                Supprimer « {confirmDelete?.name} » ?
              </Text>
              <Text className="text-[11px] font-medium text-gray-500 text-center">
                {deletingCount > 0
                  ? `Ses ${deletingCount} article${deletingCount > 1 ? 's' : ''} passent dans « Sans catégorie ». Aucun n'est supprimé.`
                  : "Aucun article n'utilise cette catégorie."}
              </Text>
            </View>
            <View className="gap-2">
              <Pressable
                onPress={() => {
                  if (confirmDelete) deleteArticleCategory(confirmDelete.id);
                  setConfirmDelete(null);
                }}
                className="py-4 bg-danger rounded-2xl"
              >
                <Text className="text-xs font-black uppercase text-center text-white">Supprimer</Text>
              </Pressable>
              <Pressable onPress={() => setConfirmDelete(null)} className="py-4">
                <Text className="text-xs font-black text-gray-400 uppercase text-center">Annuler</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
