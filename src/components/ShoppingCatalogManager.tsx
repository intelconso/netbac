import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert, ScrollView, Modal } from 'react-native';
import { ArrowLeftRight, Check, ChevronDown, ChevronRight, Edit2, Plus, RotateCcw, Trash2, X } from 'lucide-react-native';
import { useActiveStore } from '../lib/useActive';
import { useStore } from '../lib/store';
import { cn } from '../lib/utils';
import { DEFAULT_SHOPPING_ITEMS, DEFAULT_SUPPLIERS, UNASSIGNED_SUPPLIER, shoppingGroups } from '../lib/shopping';

// Réglage du catalogue de courses : fournisseurs et produits proposés à la
// saisie. Les QUANTITÉS ne se touchent pas ici — elles vivent sur l'écran
// Courses et se vident d'un bouton, sans jamais toucher à ce catalogue.

export default function ShoppingCatalogManager() {
  const state = useActiveStore();
  const {
    addSupplier, updateSupplier, deleteSupplier,
    addShoppingItem, updateShoppingItem, deleteShoppingItem,
    restoreDefaultShoppingCatalog,
  } = useStore();

  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({});
  const [editingSupplier, setEditingSupplier] = useState<{ id: string; name: string; note: string } | null>(null);
  const [editingItem, setEditingItem] = useState<{ id: string; name: string; supplierId: string | null } | null>(null);
  const [moving, setMoving] = useState<{ id: string; name: string; supplierId: string | null } | null>(null);
  const [newItemFor, setNewItemFor] = useState<string | null | undefined>(undefined);
  const [newItemName, setNewItemName] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNote, setNewNote] = useState('');

  // Le catalogue complet — quantités ignorées, elles n'ont rien à faire ici.
  const groups = useMemo(() => shoppingGroups(state), [state.suppliers, state.shoppingItems, state.shoppingEntries]);

  const missingDefaults = useMemo(() => {
    const suppliers = state.suppliers ?? [];
    const items = state.shoppingItems ?? [];
    return DEFAULT_SUPPLIERS.filter((d) => !suppliers.some((s) => s.id === d.id)).length
      + DEFAULT_SHOPPING_ITEMS.filter((d) => !items.some((i) => i.id === d.id)).length;
  }, [state.suppliers, state.shoppingItems]);

  const fail = (error?: string) => Alert.alert('Impossible', error ?? 'Action refusée.');

  const submitSupplier = () => {
    const res = addSupplier({ name: newName, note: newNote });
    if (!res.ok) return fail(res.error);
    setNewName(''); setNewNote(''); setAdding(false);
  };

  const saveSupplier = () => {
    if (!editingSupplier) return;
    const res = updateSupplier(editingSupplier.id, { name: editingSupplier.name, note: editingSupplier.note });
    if (!res.ok) return fail(res.error);
    setEditingSupplier(null);
  };

  const removeSupplier = (id: string, name: string, count: number) => {
    Alert.alert(
      `Supprimer ${name} ?`,
      count > 0
        ? `Ses ${count} produit${count > 1 ? 's' : ''} sont supprimés avec lui.`
        : 'Ce fournisseur sera retiré de la liste.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteSupplier(id) },
      ]
    );
  };

  const submitItem = (supplierId: string | null) => {
    const res = addShoppingItem({ name: newItemName, supplierId: supplierId ?? undefined });
    if (!res.ok) return fail(res.error);
    setNewItemName('');
  };

  const saveItem = () => {
    if (!editingItem) return;
    const res = updateShoppingItem(editingItem.id, { name: editingItem.name, supplierId: editingItem.supplierId });
    if (!res.ok) return fail(res.error);
    setEditingItem(null);
  };

  // Déplacement d'un produit vers un autre fournisseur. Le produit DÉMÉNAGE —
  // même enregistrement, même id — donc sa quantité en cours le suit, ce qu'un
  // « supprimer puis recréer » aurait perdu.
  //
  // Peut échouer : le nom peut déjà exister chez la destination (Fraise est à
  // la fois un sirop, un coulis et un fruit). On le dit au lieu d'écraser.
  const move = (target: string | null) => {
    if (!moving) return;
    const res = updateShoppingItem(moving.id, { supplierId: target });
    if (!res.ok) return fail(res.error);
    // Ouvrir la destination : sans ça, le produit semble avoir disparu.
    setOpenKeys((st) => ({ ...st, [target ?? '__none__']: true }));
    setMoving(null);
  };

  const restore = () => {
    const n = restoreDefaultShoppingCatalog();
    Alert.alert('Catalogue', n > 0 ? `${n} entrée${n > 1 ? 's' : ''} restaurée${n > 1 ? 's' : ''}.` : 'Rien à restaurer.');
  };

  return (
    <View className="gap-3">
      {groups.map((group) => {
        const key = group.id ?? '__none__';
        const open = !!openKeys[key];
        // Les lignes libres appartiennent à la tournée en cours, pas au
        // catalogue : elles n'ont ni à se compter ni à s'éditer ici.
        const items = group.lines.filter((l) => !l.isExtra);
        return (
          <View key={key} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {editingSupplier?.id === group.id ? (
              <View className="p-3 gap-2">
                <TextInput
                  value={editingSupplier.name}
                  onChangeText={(v) => setEditingSupplier({ ...editingSupplier, name: v })}
                  placeholder="Nom du fournisseur"
                  className="px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-bold"
                />
                <TextInput
                  value={editingSupplier.note}
                  onChangeText={(v) => setEditingSupplier({ ...editingSupplier, note: v })}
                  placeholder="Note (optionnel) — ex. lundi pour mardi"
                  className="px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-bold"
                />
                <View className="flex-row gap-2">
                  <Pressable onPress={saveSupplier} className="flex-1 h-10 rounded-xl bg-primary items-center justify-center">
                    <Check size={16} color="#FFFFFF" />
                  </Pressable>
                  <Pressable onPress={() => setEditingSupplier(null)} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
                    <X size={16} color="#9CA3AF" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setOpenKeys((st) => ({ ...st, [key]: !st[key] }))}
                className="flex-row items-center gap-2 px-4 py-3 active:bg-gray-50"
              >
                <View className="flex-1">
                  <Text className="text-xs font-black text-gray-900 uppercase tracking-wide">{group.name}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">
                    {items.length} produit{items.length > 1 ? 's' : ''}
                    {group.note ? ` · ${group.note}` : ''}
                  </Text>
                </View>
                {/* « Sans fournisseur » n'est pas un enregistrement : il n'y a
                    ni à le renommer ni à le supprimer. */}
                {group.id && (
                  <>
                    <Pressable
                      onPress={() => setEditingSupplier({ id: group.id!, name: group.name, note: group.note ?? '' })}
                      hitSlop={6}
                      className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                    >
                      <Edit2 size={14} color="#9CA3AF" />
                    </Pressable>
                    <Pressable
                      onPress={() => removeSupplier(group.id!, group.name, items.length)}
                      hitSlop={6}
                      className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
                    >
                      <Trash2 size={14} color="#EF4444" />
                    </Pressable>
                  </>
                )}
                {open ? <ChevronDown size={16} color="#D1D5DB" /> : <ChevronRight size={16} color="#D1D5DB" />}
              </Pressable>
            )}

            {open && (
              <View className="px-3 pb-3 gap-2">
                {items.map((line) => (
                  editingItem?.id === line.id ? (
                    <View key={line.id} className="p-2 gap-2 bg-gray-50 rounded-xl">
                      <TextInput
                        value={editingItem.name}
                        onChangeText={(v) => setEditingItem({ ...editingItem, name: v })}
                        placeholder="Nom du produit"
                        className="px-3 py-2.5 bg-white rounded-xl text-sm font-bold"
                      />
                      <View className="flex-row gap-2">
                        <Pressable onPress={saveItem} className="flex-1 h-10 rounded-xl bg-primary items-center justify-center">
                          <Check size={16} color="#FFFFFF" />
                        </Pressable>
                        <Pressable onPress={() => setEditingItem(null)} className="w-10 h-10 rounded-xl bg-white items-center justify-center">
                          <X size={16} color="#9CA3AF" />
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View key={line.id} className="flex-row items-center gap-2 px-3 py-2 rounded-xl border border-gray-100">
                      <Text className="flex-1 text-sm font-bold text-gray-700" numberOfLines={1}>{line.name}</Text>
                      {/* Déplacer est une action à part entière, pas un réglage
                          enfoui dans le formulaire de renommage : c'est le seul
                          moyen de ranger un produit ailleurs sans le supprimer
                          puis le recréer — et sa quantité en cours le suit. */}
                      <Pressable
                        onPress={() => setMoving({ id: line.id, name: line.name, supplierId: group.id })}
                        hitSlop={6}
                        className="w-9 h-9 rounded-xl bg-blue-50 items-center justify-center"
                      >
                        <ArrowLeftRight size={14} color="#3B82F6" />
                      </Pressable>
                      <Pressable
                        onPress={() => setEditingItem({ id: line.id, name: line.name, supplierId: group.id })}
                        hitSlop={6}
                        className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center"
                      >
                        <Edit2 size={14} color="#9CA3AF" />
                      </Pressable>
                      <Pressable
                        onPress={() => Alert.alert(`Supprimer ${line.name} ?`, 'Le produit quitte le catalogue de courses.', [
                          { text: 'Annuler', style: 'cancel' },
                          { text: 'Supprimer', style: 'destructive', onPress: () => deleteShoppingItem(line.id) },
                        ])}
                        hitSlop={6}
                        className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center"
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </Pressable>
                    </View>
                  )
                ))}

                {newItemFor === group.id ? (
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      value={newItemName}
                      onChangeText={setNewItemName}
                      placeholder="Nom du produit"
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => submitItem(group.id)}
                      className="flex-1 px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-bold"
                    />
                    <Pressable onPress={() => submitItem(group.id)} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
                      <Plus size={16} color="#FFFFFF" />
                    </Pressable>
                    <Pressable
                      onPress={() => { setNewItemFor(undefined); setNewItemName(''); }}
                      className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center"
                    >
                      <X size={16} color="#9CA3AF" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => { setNewItemFor(group.id); setNewItemName(''); }}
                    className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-gray-50 active:bg-gray-100"
                  >
                    <Plus size={13} color="#9CA3AF" />
                    <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Ajouter un produit</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        );
      })}

      {groups.length === 0 && (
        <Text className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center py-6">
          Aucun fournisseur
        </Text>
      )}

      {adding ? (
        <View className="bg-white p-3 rounded-2xl border border-gray-100 gap-2">
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Nom du fournisseur"
            autoFocus
            className="px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-bold"
          />
          <TextInput
            value={newNote}
            onChangeText={setNewNote}
            placeholder="Note (optionnel) — ex. lundi pour mardi"
            returnKeyType="done"
            onSubmitEditing={submitSupplier}
            className="px-3 py-2.5 bg-gray-50 rounded-xl text-sm font-bold"
          />
          <View className="flex-row gap-2">
            <Pressable onPress={submitSupplier} className="flex-1 h-10 rounded-xl bg-primary items-center justify-center">
              <Text className="text-[10px] font-black text-white uppercase tracking-widest">Ajouter</Text>
            </Pressable>
            <Pressable
              onPress={() => { setAdding(false); setNewName(''); setNewNote(''); }}
              className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center"
            >
              <X size={16} color="#9CA3AF" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setAdding(true)}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-white border border-gray-100 active:bg-gray-50"
        >
          <Plus size={14} color="#10B981" />
          <Text className="text-[10px] font-black text-primary uppercase tracking-widest">Nouveau fournisseur</Text>
        </Pressable>
      )}

      {missingDefaults > 0 && (
        <Pressable
          onPress={restore}
          className="flex-row items-center justify-center gap-2 py-3 rounded-2xl bg-gray-50 active:bg-gray-100"
        >
          <RotateCcw size={13} color="#9CA3AF" />
          <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
            Restaurer le catalogue d'origine
          </Text>
        </Pressable>
      )}

      <Text className="text-[9px] font-bold text-gray-300 uppercase tracking-widest text-center mt-2 px-4">
        {UNASSIGNED_SUPPLIER} regroupe les produits sans magasin — ils restent commandables.
      </Text>

      {/* Choix de la destination. Une liste plutôt qu'un glisser-déposer : la
          section visée est souvent repliée ou à quatre écrans de distance, et
          un doigt maintenu pendant le défilement n'aurait rien de fiable. */}
      <Modal visible={!!moving} transparent animationType="fade" onRequestClose={() => setMoving(null)}>
        <Pressable className="flex-1 bg-black/60 items-center justify-center p-6" onPress={() => setMoving(null)}>
          <Pressable className="bg-white w-full rounded-3xl p-5 gap-3" style={{ maxWidth: 400 }} onPress={() => {}}>
            <View className="items-center gap-1">
              <View className="w-12 h-12 rounded-full bg-blue-50 items-center justify-center mb-1">
                <ArrowLeftRight size={20} color="#3B82F6" />
              </View>
              <Text className="text-base font-black uppercase text-gray-900 text-center">Déplacer</Text>
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">
                {moving?.name}
              </Text>
            </View>

            <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 6 }}>
              {[...(state.suppliers ?? []).map((sup) => ({ id: sup.id as string | null, name: sup.name })),
                { id: null as string | null, name: UNASSIGNED_SUPPLIER }].map((dest) => {
                const here = (moving?.supplierId ?? null) === dest.id;
                return (
                  <Pressable
                    key={dest.id ?? '__none__'}
                    onPress={() => (here ? setMoving(null) : move(dest.id))}
                    className={cn(
                      'flex-row items-center gap-3 px-4 py-3 rounded-2xl border',
                      here ? 'bg-gray-50 border-gray-100' : 'bg-white border-gray-100 active:bg-blue-50'
                    )}
                  >
                    <Text className={cn('flex-1 text-xs font-black uppercase tracking-wide', here ? 'text-gray-400' : 'text-gray-900')}>
                      {dest.name}
                    </Text>
                    {here && <Check size={16} color="#10B981" />}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable onPress={() => setMoving(null)} className="h-11 rounded-2xl bg-gray-50 items-center justify-center">
              <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
