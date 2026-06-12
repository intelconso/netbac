import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { CheckCircle2, Pencil, Plus, Truck, XCircle } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { ReceptionCheck } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;

// Réceptions de la journée — un enregistrement par livraison : fournisseur,
// n° de BL ou facture, contrôle à réception conforme / non conforme (action
// corrective exigée en cas d'écart). Pas de notion de jour manqué : il n'y a
// pas forcément de livraison chaque jour.
export default function ReceptionSection() {
  const { receptions, addReception, updateReception } = useActiveStore();

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplier, setSupplier] = useState('');
  const [reference, setReference] = useState('');
  const [result, setResult] = useState<'conforme' | 'non_conforme'>('conforme');
  const [correctiveAction, setCorrectiveAction] = useState('');

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const today = receptions
    .filter((r) => r.timestamp >= startOfToday && r.timestamp < startOfToday + DAY)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Suggestions: most recent distinct suppliers, to avoid retyping.
  const knownSuppliers = [...new Set([...receptions].sort((a, b) => b.timestamp - a.timestamp).map((r) => r.supplier))].slice(0, 6);

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setSupplier('');
    setReference('');
    setResult('conforme');
    setCorrectiveAction('');
  };

  const startEdit = (r: ReceptionCheck) => {
    setEditingId(r.id);
    setSupplier(r.supplier);
    setReference(r.reference ?? '');
    setResult(r.result);
    setCorrectiveAction(r.correctiveAction ?? '');
    setIsAdding(true);
  };

  const canSave = supplier.trim().length > 0 && (result === 'conforme' || correctiveAction.trim().length > 0);

  const handleSave = () => {
    if (!canSave) return;
    const data = {
      supplier: supplier.trim(),
      result,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      ...(result === 'non_conforme' ? { correctiveAction: correctiveAction.trim() } : {}),
    };
    if (editingId) updateReception(editingId, data);
    else addReception(data);
    closeForm();
  };

  return (
    <View className="gap-4">
      {!isAdding && (
        <Pressable onPress={() => setIsAdding(true)} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
          <Plus size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Nouvelle réception</Text>
        </Pressable>
      )}

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Nom du fournisseur</Text>
            <TextInput value={supplier} onChangeText={setSupplier} placeholder="Ex. Metro, Transgourmet..." className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
            {knownSuppliers.length > 0 && !supplier && (
              <View className="flex-row flex-wrap gap-2">
                {knownSuppliers.map((s) => (
                  <Pressable key={s} onPress={() => setSupplier(s)} className="px-3 py-1.5 rounded-xl bg-gray-50 border border-gray-100">
                    <Text className="text-[10px] font-bold text-gray-600 uppercase">{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">N° de BL ou n° de facture</Text>
            <TextInput value={reference} onChangeText={setReference} placeholder="Ex. BL-20260612-042" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          </View>

          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Résultat des contrôles à réception</Text>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setResult('conforme')} className={cn('flex-1 py-3 rounded-xl border items-center', result === 'conforme' ? 'bg-success/10 border-success' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', result === 'conforme' ? 'text-success' : 'text-gray-400')}>Conforme</Text>
              </Pressable>
              <Pressable onPress={() => setResult('non_conforme')} className={cn('flex-1 py-3 rounded-xl border items-center', result === 'non_conforme' ? 'bg-danger/10 border-danger' : 'bg-gray-50 border-gray-100')}>
                <Text className={cn('text-[10px] font-black uppercase', result === 'non_conforme' ? 'text-danger' : 'text-gray-400')}>Non conforme</Text>
              </Pressable>
            </View>
          </View>

          {result === 'non_conforme' && (
            <View className="gap-2">
              <Text className="text-[9px] font-black text-danger uppercase tracking-widest">Action corrective requise</Text>
              <TextInput
                value={correctiveAction}
                onChangeText={setCorrectiveAction}
                placeholder="Ex. lot refusé, retour fournisseur, produit écarté..."
                className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
              />
            </View>
          )}

          <View className="flex-row gap-2">
            <Pressable onPress={closeForm} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
            <Pressable disabled={!canSave} onPress={handleSave} className={cn('flex-1 py-3 bg-primary rounded-xl', !canSave && 'opacity-40')}>
              <Text className="text-[10px] font-black uppercase text-center text-white">{editingId ? 'Modifier' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View className="gap-3">
        {today.map((r) => (
          <View key={r.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className={cn('w-10 h-10 rounded-xl items-center justify-center', r.result === 'conforme' ? 'bg-success/10' : 'bg-danger/10')}>
                {r.result === 'conforme'
                  ? <CheckCircle2 size={18} color="#10B981" />
                  : <XCircle size={18} color="#EF4444" />}
              </View>
              <View className="flex-1">
                <Text className="text-xs font-black text-gray-900 uppercase">{r.supplier}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5" numberOfLines={1}>
                  {format(new Date(r.timestamp), 'HH:mm', { locale: fr })}
                  {r.reference ? ` • ${r.reference}` : ''}
                  {r.correctiveAction ? ` • ${r.correctiveAction}` : ''}
                </Text>
              </View>
            </View>
            <Pressable onPress={() => startEdit(r)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
              <Pencil size={14} color="#9CA3AF" />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
