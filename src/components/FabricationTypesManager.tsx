import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { ChefHat, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { useStore } from '../lib/store';
import { cn, randomId } from '../lib/utils';
import { STANDARD_FABRICATION_TYPE } from '../lib/fabrication';
import { FabricationField, FabricationFieldKind } from '../types';

const KIND_LABELS: Record<FabricationFieldKind, string> = {
  text: 'Texte',
  number: 'Nombre',
  choice: 'Choix',
  multi_choice: 'Choix multiple',
  toggle: 'Case à cocher',
};
const KINDS = Object.keys(KIND_LABELS) as FabricationFieldKind[];
const needsOptions = (k: FabricationFieldKind) => k === 'choice' || k === 'multi_choice';

// Paramètres → Types de fabrication : l'admin définit des types dont les
// champs pilotent le formulaire de fabrication (schema-driven). Les
// enregistrements snapshotent leurs libellés, donc éditer/supprimer un type
// ne casse jamais l'historique.
export default function FabricationTypesManager() {
  const fabricationTypes = useStore((s) => s.fabricationTypes);
  const addFabricationType = useStore((s) => s.addFabricationType);
  const updateFabricationType = useStore((s) => s.updateFabricationType);
  const removeFabricationType = useStore((s) => s.removeFabricationType);
  const liveTypes = (fabricationTypes ?? []).filter((t) => !t.deletedAt);

  // Type being built/edited; null = list view.
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [label, setLabel] = useState('');
  const [fields, setFields] = useState<FabricationField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);

  // New-field mini form
  const [nfLabel, setNfLabel] = useState('');
  const [nfKind, setNfKind] = useState<FabricationFieldKind>('text');
  const [nfRequired, setNfRequired] = useState(false);
  const [nfUnit, setNfUnit] = useState('');
  const [nfOptions, setNfOptions] = useState('');

  const resetFieldForm = () => {
    setNfLabel('');
    setNfKind('text');
    setNfRequired(false);
    setNfUnit('');
    setNfOptions('');
  };

  const openBuilder = (typeId?: string) => {
    if (typeId) {
      const t = liveTypes.find((x) => x.id === typeId);
      if (!t) return;
      setEditingId(t.id);
      setLabel(t.label);
      setFields(t.fields);
    } else {
      setEditingId('new');
      setLabel('');
      setFields([]);
    }
    setError(null);
    resetFieldForm();
  };

  const addField = () => {
    const l = nfLabel.trim();
    if (!l) { setError('Donne un libellé au champ.'); return; }
    const options = nfOptions.split(',').map((o) => o.trim()).filter(Boolean);
    if (needsOptions(nfKind) && options.length < 2) {
      setError('Un champ à choix doit avoir au moins 2 options (séparées par des virgules).');
      return;
    }
    setFields((fs) => [...fs, {
      id: randomId(),
      label: l,
      kind: nfKind,
      ...(nfRequired ? { required: true } : {}),
      ...(needsOptions(nfKind) ? { options } : {}),
      ...(nfKind === 'number' && nfUnit.trim() ? { unit: nfUnit.trim() } : {}),
    }]);
    setError(null);
    resetFieldForm();
  };

  const saveType = () => {
    const l = label.trim();
    if (!l) { setError('Donne un nom au type.'); return; }
    if (fields.length === 0) { setError('Ajoute au moins un champ.'); return; }
    if (editingId === 'new') addFabricationType({ label: l, fields });
    else if (editingId) updateFabricationType(editingId, { label: l, fields });
    setEditingId(null);
    setError(null);
  };

  if (editingId !== null) {
    return (
      <View className="gap-4">
        <View className="gap-2">
          <Text className="text-[9px] font-bold text-gray-400 uppercase">Nom du type</Text>
          <TextInput value={label} onChangeText={setLabel} placeholder="Ex. Sauce mère, Cuisson sous vide..." className="p-3 bg-white border border-gray-100 rounded-xl text-sm font-bold" />
        </View>

        <View className="gap-2">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Champs du formulaire ({fields.length})</Text>
          {fields.map((f, i) => (
            <View key={f.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
              <View className="flex-1">
                <Text className="text-xs font-black text-gray-900 uppercase">{f.label}{f.required ? ' *' : ''}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                  {KIND_LABELS[f.kind]}
                  {f.unit ? ` (${f.unit})` : ''}
                  {f.options ? ` : ${f.options.join(', ')}` : ''}
                </Text>
              </View>
              <Pressable onPress={() => setFields((fs) => fs.filter((x) => x.id !== f.id))} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
                <X size={14} color="#EF4444" />
              </Pressable>
            </View>
          ))}

          <View className="bg-white p-3 rounded-2xl border-2 border-primary/20 gap-3">
            <TextInput value={nfLabel} onChangeText={setNfLabel} placeholder="Libellé du champ (ex. T°C début)" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
            <View className="flex-row flex-wrap gap-2">
              {KINDS.map((k) => (
                <Pressable key={k} onPress={() => setNfKind(k)} className={cn('px-3 py-2 rounded-xl border', nfKind === k ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}>
                  <Text className={cn('text-[10px] font-bold uppercase', nfKind === k ? 'text-primary' : 'text-gray-600')}>{KIND_LABELS[k]}</Text>
                </Pressable>
              ))}
            </View>
            {nfKind === 'number' && (
              <TextInput value={nfUnit} onChangeText={setNfUnit} placeholder="Unité (ex. °C, min) — optionnel" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
            )}
            {needsOptions(nfKind) && (
              <TextInput value={nfOptions} onChangeText={setNfOptions} placeholder="Options séparées par des virgules" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
            )}
            <View className="flex-row items-center justify-between">
              <Pressable onPress={() => setNfRequired((v) => !v)} className="flex-row items-center gap-2">
                <View className={cn('w-5 h-5 rounded-md border items-center justify-center', nfRequired ? 'bg-primary border-primary' : 'border-gray-300')}>
                  {nfRequired && <Text className="text-white text-[10px] font-black">✓</Text>}
                </View>
                <Text className="text-[10px] font-bold text-gray-600 uppercase">Obligatoire</Text>
              </Pressable>
              <Pressable onPress={addField} className="px-4 py-2.5 bg-primary rounded-xl flex-row items-center gap-1.5">
                <Plus size={14} color="#fff" />
                <Text className="text-[10px] font-black text-white uppercase">Ajouter le champ</Text>
              </Pressable>
            </View>
          </View>
        </View>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-xl p-3">
            <Text className="text-[10px] font-bold text-red-700">{error}</Text>
          </View>
        )}

        <View className="flex-row gap-2">
          <Pressable onPress={() => { setEditingId(null); setError(null); }} className="flex-1 py-3">
            <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
          </Pressable>
          <Pressable onPress={saveType} className="flex-1 py-3 bg-primary rounded-xl">
            <Text className="text-[10px] font-black uppercase text-center text-white">{editingId === 'new' ? 'Créer le type' : 'Enregistrer'}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4">
      <View className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3 opacity-70">
        <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center">
          <ChefHat size={18} color="#9CA3AF" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-black text-gray-900 uppercase">{STANDARD_FABRICATION_TYPE.label}</Text>
          <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Type intégré • {STANDARD_FABRICATION_TYPE.fields.length} champs</Text>
        </View>
      </View>

      {liveTypes.map((t) => (
        <View key={t.id} className="bg-white p-3 rounded-2xl border border-gray-100 flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
            <ChefHat size={18} color="#10B981" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 uppercase">{t.label}</Text>
            <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">{t.fields.length} champ{t.fields.length > 1 ? 's' : ''}</Text>
          </View>
          <Pressable onPress={() => openBuilder(t.id)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
            <Pencil size={14} color="#9CA3AF" />
          </Pressable>
          <Pressable onPress={() => setConfirmDelete({ id: t.id, label: t.label })} className="w-9 h-9 rounded-xl bg-red-50 items-center justify-center">
            <Trash2 size={14} color="#EF4444" />
          </Pressable>
        </View>
      ))}

      {confirmDelete && (
        <View className="bg-white p-4 rounded-2xl border border-red-200 gap-3">
          <Text className="text-[10px] font-bold text-gray-600 uppercase">
            Supprimer le type « {confirmDelete.label} » ? Les fabrications déjà enregistrées restent intactes.
          </Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setConfirmDelete(null)} className="flex-1 py-3">
              <Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text>
            </Pressable>
            <Pressable onPress={() => { removeFabricationType(confirmDelete.id); setConfirmDelete(null); }} className="flex-1 py-3 bg-danger rounded-xl">
              <Text className="text-[10px] font-black uppercase text-center text-white">Supprimer</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Pressable onPress={() => openBuilder()} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
        <Plus size={14} color="#fff" />
        <Text className="text-[10px] font-black text-white uppercase">Nouveau type</Text>
      </Pressable>
    </View>
  );
}
