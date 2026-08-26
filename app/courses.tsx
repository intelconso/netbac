import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronRight, Minus, Plus, Search, Send, Settings2, ShoppingCart, Trash2, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../src/lib/useActive';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import {
  ShoppingGroup, ShoppingLine, formatQty, generateAndShareShoppingList,
  normalizeShoppingName, shoppingGroups,
} from '../src/lib/shopping';

// Courses — la liste de ce qu'il faut acheter, groupée par fournisseur.
//
// Rien de commun avec les étiquettes ni avec l'inventaire : catalogue séparé,
// quantités séparées, aucun stock n'est lu ni touché ici (voir shopping.ts).
//
// L'écran n'a qu'un métier : remplir vite. D'où le compteur ±/clavier sur
// chaque ligne, la recherche qui traverse tous les fournisseurs, et le PDF
// atteignable en permanence depuis la barre du bas — pas au bout d'un tunnel.

const ROW_ACCENT = '#10B981';

// Une ligne = un produit et sa quantité. Mémoïsée, et surtout autonome sur la
// saisie clavier : le champ garde SA chaîne tant qu'on tape (« 1 » puis « 2 »
// fait 12), et ne se resynchronise sur le store qu'une fois le doigt parti.
// Sans ça, chaque frappe repasserait par le store et écraserait la saisie.
const Row = memo(function Row({
  line, onSet, onRemoveExtra,
}: {
  line: ShoppingLine;
  onSet: (id: string, qty: number) => void;
  onRemoveExtra: (id: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (line.qty > 0 ? formatQty(line.qty) : '');
  const active = line.qty > 0;

  const commit = (text: string) => {
    const parsed = parseFloat(text.replace(',', '.'));
    onSet(line.id, Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
    setDraft(null);
  };

  return (
    <View
      className={cn(
        'flex-row items-center gap-2 px-3 py-2 rounded-2xl border',
        active ? 'bg-primary/5 border-primary/30' : 'bg-white border-gray-100'
      )}
    >
      <View className="w-1 h-8 rounded-full" style={{ backgroundColor: active ? ROW_ACCENT : '#F3F4F6' }} />
      <View className="flex-1">
        <Text
          className={cn('text-sm font-black uppercase', active ? 'text-gray-900' : 'text-gray-500')}
          numberOfLines={2}
        >
          {line.name}
        </Text>
        {line.isExtra && (
          <Text className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mt-0.5">
            Ajout ponctuel
          </Text>
        )}
      </View>

      {/* Une ligne libre à 0 n'a aucune raison de rester : elle n'existe que
          pour cette tournée. La corbeille ne s'affiche donc que sur elle. */}
      {line.isExtra && (
        <Pressable
          onPress={() => onRemoveExtra(line.id)}
          hitSlop={6}
          className="w-8 h-8 rounded-xl bg-gray-50 items-center justify-center"
        >
          <Trash2 size={14} color="#D1D5DB" />
        </Pressable>
      )}

      <Pressable
        onPress={() => onSet(line.id, Math.max(0, line.qty - 1))}
        disabled={line.qty <= 0}
        hitSlop={4}
        className={cn('w-9 h-9 rounded-xl items-center justify-center', line.qty > 0 ? 'bg-gray-100' : 'bg-gray-50')}
      >
        <Minus size={16} color={line.qty > 0 ? '#374151' : '#E5E7EB'} />
      </Pressable>

      {/* La quantité se TAPE autant qu'elle s'incrémente : douze limonades ne
          se saisissent pas en douze appuis. D'où la bordure et le fond blanc —
          sans eux le champ se lit comme un simple affichage, et personne ne
          pense à le toucher. `selectTextOnFocus` remplace la valeur d'un coup
          au lieu de faire écrire à la suite de l'ancienne. */}
      <TextInput
        value={shown}
        onChangeText={setDraft}
        onFocus={() => setDraft(shown)}
        onBlur={() => commit(draft ?? shown)}
        onSubmitEditing={() => commit(draft ?? shown)}
        selectTextOnFocus
        keyboardType="numeric"
        returnKeyType="done"
        placeholder="0"
        placeholderTextColor="#D1D5DB"
        style={{ width: 58, textAlign: 'center' }}
        className={cn(
          'py-2 rounded-xl text-base font-black bg-white border',
          active ? 'text-gray-900 border-primary' : 'text-gray-400 border-gray-200'
        )}
      />

      <Pressable
        onPress={() => onSet(line.id, line.qty + 1)}
        hitSlop={4}
        className="w-9 h-9 rounded-xl bg-primary items-center justify-center"
      >
        <Plus size={16} color="#FFFFFF" />
      </Pressable>
    </View>
  );
});

// Le formulaire d'ajout ponctuel, replié sous chaque fournisseur.
function ExtraForm({ supplierId, onDone }: { supplierId: string | null; onDone: () => void }) {
  const addShoppingExtra = useStore((s) => s.addShoppingExtra);
  const [name, setName] = useState('');

  const submit = () => {
    const res = addShoppingExtra({ name, supplierId: supplierId ?? undefined, qty: 1 });
    if (!res.ok) {
      Alert.alert('Impossible', res.error ?? 'Produit invalide.');
      return;
    }
    setName('');
    onDone();
  };

  return (
    <View className="flex-row items-center gap-2 mt-1">
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Nom du produit"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
        className="flex-1 px-3 py-2.5 bg-gray-50 rounded-2xl text-sm font-bold"
      />
      <Pressable onPress={submit} className="px-4 h-10 rounded-2xl bg-primary items-center justify-center">
        <Text className="text-[10px] font-black text-white uppercase tracking-widest">Ajouter</Text>
      </Pressable>
      <Pressable onPress={onDone} className="w-10 h-10 rounded-2xl bg-gray-50 items-center justify-center">
        <X size={16} color="#9CA3AF" />
      </Pressable>
    </View>
  );
}

export default function CoursesScreen() {
  const router = useRouter();
  const state = useActiveStore();
  const setShoppingQty = useStore((s) => s.setShoppingQty);
  const removeShoppingExtra = useStore((s) => s.removeShoppingExtra);
  const clearShoppingList = useStore((s) => s.clearShoppingList);

  const [searchTerm, setSearchTerm] = useState('');
  const [requestedOnly, setRequestedOnly] = useState(false);
  const [closedKeys, setClosedKeys] = useState<Record<string, boolean>>({});
  const [extraFor, setExtraFor] = useState<string | null | undefined>(undefined);
  const [sharing, setSharing] = useState(false);

  const query = normalizeShoppingName(searchTerm);

  const allGroups = useMemo(
    () => shoppingGroups(state, { onlyRequested: requestedOnly }),
    [state.suppliers, state.shoppingItems, state.shoppingEntries, requestedOnly]
  );

  // Le filtre s'applique aux lignes ; un fournisseur dont plus rien ne passe
  // disparaît de lui-même.
  const groups: ShoppingGroup[] = useMemo(() => {
    if (!query) return allGroups;
    return allGroups
      .map((g) => ({ ...g, lines: g.lines.filter((l) => normalizeShoppingName(l.name).includes(query)) }))
      .filter((g) => g.lines.length > 0);
  }, [allGroups, query]);

  const total = useMemo(
    () => allGroups.reduce((n, g) => n + g.lines.filter((l) => l.qty > 0).length, 0),
    [allGroups]
  );

  const onSet = useCallback((id: string, qty: number) => setShoppingQty(id, qty), [setShoppingQty]);
  const onRemoveExtra = useCallback((id: string) => removeShoppingExtra(id), [removeShoppingExtra]);

  // Une recherche ouvre tout : masquer un résultat derrière une section repliée
  // reviendrait à dire qu'il n'existe pas.
  const forceOpen = !!query;

  const handleShare = async () => {
    if (total === 0) {
      Alert.alert('Liste vide', "Renseignez au moins une quantité avant d'envoyer la liste.");
      return;
    }
    setSharing(true);
    try {
      await generateAndShareShoppingList(useStore.getState());
    } catch (e: any) {
      Alert.alert('Erreur', e?.message || "Impossible de générer le PDF.");
    } finally {
      setSharing(false);
    }
  };

  const handleClear = () => {
    if (total === 0) return;
    Alert.alert(
      'Vider la liste ?',
      `Les ${total} quantité${total > 1 ? 's' : ''} saisie${total > 1 ? 's' : ''} repassent à zéro. Le catalogue des produits n'est pas touché.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Vider', style: 'destructive', onPress: () => clearShoppingList() },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50 gap-4">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 uppercase">Courses</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
              {total > 0 ? `${total} produit${total > 1 ? 's' : ''} à acheter` : 'Aucune quantité saisie'}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/courses-catalog' as any)}
            className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center"
          >
            <Settings2 size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        <View className="relative">
          <View className="absolute left-4 top-3.5 z-10"><Search size={16} color="#9CA3AF" /></View>
          <TextInput
            placeholder="Rechercher un produit..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            className="pl-12 pr-4 py-3 bg-gray-50 rounded-2xl text-sm font-bold"
          />
        </View>

        <Pressable
          onPress={() => setRequestedOnly((v) => !v)}
          className={cn('self-start px-4 py-2 rounded-xl flex-row items-center gap-2', requestedOnly ? 'bg-primary' : 'bg-gray-50')}
        >
          <ShoppingCart size={12} color={requestedOnly ? '#fff' : '#9CA3AF'} />
          <Text className={cn('text-[9px] font-black uppercase tracking-widest', requestedOnly ? 'text-white' : 'text-gray-400')}>
            À acheter · {total}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {groups.map((group) => {
            const key = group.id ?? '__none__';
            const open = forceOpen || !closedKeys[key];
            const requested = group.lines.filter((l) => l.qty > 0).length;
            return (
              <View key={key} className="bg-white rounded-3xl border border-gray-100 overflow-hidden">
                <Pressable
                  onPress={() => setClosedKeys((st) => ({ ...st, [key]: !st[key] }))}
                  className="flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50"
                >
                  <View className="flex-1">
                    <Text className="text-xs font-black text-gray-900 uppercase tracking-wide">{group.name}</Text>
                    {!!group.note && (
                      <Text className="text-[9px] font-bold text-alert uppercase tracking-widest mt-0.5">{group.note}</Text>
                    )}
                  </View>
                  {requested > 0 && (
                    <View className="px-2.5 py-1 rounded-full bg-primary">
                      <Text className="text-[10px] font-black text-white">{requested}</Text>
                    </View>
                  )}
                  <Text className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                    {group.lines.length}
                  </Text>
                  {open
                    ? <ChevronDown size={16} color="#D1D5DB" />
                    : <ChevronRight size={16} color="#D1D5DB" />}
                </Pressable>

                {open && (
                  <View className="px-3 pb-3 gap-2">
                    {group.lines.map((line) => (
                      <Row key={line.id} line={line} onSet={onSet} onRemoveExtra={onRemoveExtra} />
                    ))}

                    {/* L'ajout ponctuel est proposé au pied du fournisseur
                        concerné : le produit hérite du magasin sans rien à choisir. */}
                    {!requestedOnly && !query && (
                      extraFor === group.id ? (
                        <ExtraForm supplierId={group.id} onDone={() => setExtraFor(undefined)} />
                      ) : (
                        <Pressable
                          onPress={() => setExtraFor(group.id)}
                          className="flex-row items-center justify-center gap-2 py-2.5 rounded-2xl bg-gray-50 active:bg-gray-100"
                        >
                          <Plus size={13} color="#9CA3AF" />
                          <Text className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
                            Autre produit
                          </Text>
                        </Pressable>
                      )
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {groups.length === 0 && (
            <View className="py-20 items-center gap-3 px-8">
              <ShoppingCart size={32} color="#E5E7EB" />
              <Text className="text-sm font-black text-gray-300 uppercase text-center">
                {query
                  ? 'Aucun produit ne correspond'
                  : requestedOnly
                    ? 'Rien à acheter pour le moment'
                    : 'Catalogue vide'}
              </Text>
              {!query && !requestedOnly && (
                <Text className="text-[10px] font-bold text-gray-300 uppercase tracking-widest text-center">
                  Ajoutez fournisseurs et produits depuis les réglages
                </Text>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Barre d'action toujours visible : envoyer la liste ne doit jamais
          demander de remonter en haut de soixante produits. */}
      <View className="px-4 py-3 bg-white border-t border-gray-100 flex-row items-center gap-3">
        <Pressable
          onPress={handleClear}
          disabled={total === 0}
          className={cn('w-12 h-12 rounded-2xl items-center justify-center', total > 0 ? 'bg-red-50' : 'bg-gray-50')}
        >
          <Trash2 size={18} color={total > 0 ? '#EF4444' : '#E5E7EB'} />
        </Pressable>
        <Pressable
          onPress={handleShare}
          disabled={sharing}
          className={cn(
            'flex-1 h-12 rounded-2xl flex-row items-center justify-center gap-2',
            total > 0 ? 'bg-primary' : 'bg-gray-200'
          )}
        >
          {sharing
            ? <ActivityIndicator color="#FFFFFF" size="small" />
            : <Send size={16} color="#FFFFFF" />}
          <Text className="text-[11px] font-black text-white uppercase tracking-widest">
            {sharing ? 'Génération…' : 'Envoyer la liste'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
