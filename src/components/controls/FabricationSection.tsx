import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { ChefHat, CheckCircle2, Pencil, Plus } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { fabricationDetails, getAvailableFabricationTypes } from '../../lib/fabrication';
import { lastControllerName } from '../../lib/controller';
import { Fabrication, FabricationField, FabricationValue } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;

// Draft value per field id — text for text/number inputs, string for choice,
// string[] for multi_choice, boolean for toggle.
type Draft = Record<string, string | string[] | boolean>;

// Fabrication(s) du jour — schema-driven form: the selected fabrication type
// (built-in Standard or admin-defined in Paramètres) defines the fields.
// Saved records snapshot label+value pairs so they outlive type edits.
export default function FabricationSection() {
  const store = useActiveStore();
  const { fabrications, addFabrication, updateFabrication } = store;
  const types = getAvailableFabricationTypes(store);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [typeId, setTypeId] = useState(types[0].id);
  const [name, setName] = useState('');
  const [controller, setController] = useState('');
  const [draft, setDraft] = useState<Draft>({});

  const type = types.find((t) => t.id === typeId) ?? types[0];

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const today = fabrications
    .filter((f) => f.timestamp >= startOfToday && f.timestamp < startOfToday + DAY)
    .sort((a, b) => b.timestamp - a.timestamp);

  const setField = (fieldId: string, value: string | string[] | boolean) =>
    setDraft((d) => ({ ...d, [fieldId]: value }));

  const parseNum = (raw: string): number | undefined => {
    const v = parseFloat(raw.replace(',', '.'));
    return Number.isFinite(v) ? v : undefined;
  };

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setName('');
    setDraft({});
  };

  const openForm = () => {
    setController(lastControllerName(store));
    setIsAdding(true);
  };

  const startEdit = (fab: Fabrication) => {
    setEditingId(fab.id);
    setName(fab.name);
    setController(fab.operatorName ?? lastControllerName(store));
    if (fab.typeId && types.some((t) => t.id === fab.typeId)) setTypeId(fab.typeId);
    const d: Draft = {};
    for (const v of fab.values ?? []) {
      d[v.fieldId] = Array.isArray(v.value) ? v.value : typeof v.value === 'boolean' ? v.value : String(v.value);
    }
    setDraft(d);
    setIsAdding(true);
  };

  // A field is satisfied if optional, or has a non-empty draft value.
  const fieldFilled = (f: FabricationField): boolean => {
    const v = draft[f.id];
    if (f.kind === 'multi_choice') return Array.isArray(v) && v.length > 0;
    if (f.kind === 'toggle') return true; // a toggle always has a value
    if (f.kind === 'number') return typeof v === 'string' && parseNum(v) !== undefined;
    return typeof v === 'string' && v.trim().length > 0;
  };

  const canSave = name.trim().length > 0 && controller.trim().length > 0 && type.fields.every((f) => !f.required || fieldFilled(f));

  const handleSave = () => {
    if (!canSave) return;
    const values: FabricationValue[] = [];
    for (const f of type.fields) {
      if (!fieldFilled(f) && f.kind !== 'toggle') continue;
      const raw = draft[f.id];
      const label = f.unit ? `${f.label} (${f.unit})` : f.label;
      if (f.kind === 'number') values.push({ fieldId: f.id, label, value: parseNum(raw as string)! });
      else if (f.kind === 'multi_choice') values.push({ fieldId: f.id, label, value: raw as string[] });
      else if (f.kind === 'toggle') values.push({ fieldId: f.id, label, value: raw === true });
      else values.push({ fieldId: f.id, label, value: (raw as string).trim() });
    }
    const data = { name: name.trim(), typeId: type.id, typeLabel: type.label, operatorName: controller.trim(), values };
    if (editingId) updateFabrication(editingId, data);
    else addFabrication(data);
    closeForm();
  };

  const renderField = (f: FabricationField) => {
    const v = draft[f.id];
    switch (f.kind) {
      case 'choice':
      case 'multi_choice': {
        const selected = f.kind === 'choice' ? [v as string] : ((v as string[]) ?? []);
        return (
          <View className="flex-row flex-wrap gap-2">
            {(f.options ?? []).map((opt) => {
              const active = selected.includes(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => {
                    if (f.kind === 'choice') setField(f.id, opt);
                    else setField(f.id, active ? selected.filter((x) => x !== opt) : [...selected, opt]);
                  }}
                  className={cn('px-3 py-2 rounded-xl border', active ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}
                >
                  <Text className={cn('text-[10px] font-bold uppercase', active ? 'text-primary' : 'text-gray-600')}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        );
      }
      case 'toggle': {
        const checked = v === true;
        return (
          <Pressable onPress={() => setField(f.id, !checked)} className="flex-row items-center gap-3">
            <View className={cn('w-5 h-5 rounded-md border items-center justify-center', checked ? 'bg-primary border-primary' : 'border-gray-300')}>
              {checked && <CheckCircle2 size={14} color="#fff" />}
            </View>
            <Text className="text-[10px] font-bold text-gray-600 uppercase">Oui</Text>
          </Pressable>
        );
      }
      case 'number':
        return (
          <View className="flex-row items-center gap-2">
            <TextInput
              value={(v as string) ?? ''}
              onChangeText={(t) => setField(f.id, t)}
              placeholder="—"
              keyboardType="numbers-and-punctuation"
              className="flex-1 p-3 bg-gray-50 rounded-xl text-sm font-bold"
            />
            {f.unit && <Text className="text-xs font-black text-gray-400">{f.unit}</Text>}
          </View>
        );
      default:
        return (
          <TextInput
            value={(v as string) ?? ''}
            onChangeText={(t) => setField(f.id, t)}
            placeholder="—"
            className="p-3 bg-gray-50 rounded-xl text-sm font-bold"
          />
        );
    }
  };

  return (
    <View className="gap-4">
      {!isAdding && (
        <Pressable onPress={openForm} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
          <Plus size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Nouvelle fabrication</Text>
        </Pressable>
      )}

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          {types.length > 1 && (
            <View className="gap-2">
              <Text className="text-[9px] font-bold text-gray-400 uppercase">Type de fabrication</Text>
              <View className="flex-row flex-wrap gap-2">
                {types.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => { setTypeId(t.id); setDraft({}); }}
                    className={cn('px-3 py-2 rounded-xl border', typeId === t.id ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100')}
                  >
                    <Text className={cn('text-[10px] font-bold uppercase', typeId === t.id ? 'text-primary' : 'text-gray-600')}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Nom de la préparation</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Ex. Lasagnes maison" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          </View>

          {type.fields.map((f) => (
            <View key={f.id} className="gap-2">
              <Text className="text-[9px] font-bold text-gray-400 uppercase">
                {f.label}{f.required ? ' *' : ''}
              </Text>
              {renderField(f)}
            </View>
          ))}

          <View className="gap-2">
            <Text className="text-[9px] font-bold text-gray-400 uppercase">Contrôleur</Text>
            <TextInput value={controller} onChangeText={setController} placeholder="Nom du contrôleur" className="p-3 bg-gray-50 rounded-xl text-sm font-bold" />
          </View>

          <View className="flex-row gap-2">
            <Pressable onPress={closeForm} className="flex-1 py-3"><Text className="text-[10px] font-black text-gray-400 uppercase text-center">Annuler</Text></Pressable>
            <Pressable disabled={!canSave} onPress={handleSave} className={cn('flex-1 py-3 bg-primary rounded-xl', !canSave && 'opacity-40')}>
              <Text className="text-[10px] font-black uppercase text-center text-white">{editingId ? 'Modifier' : 'Enregistrer'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View className="gap-3">
        {today.map((fab) => {
          const summary = fabricationDetails(fab).slice(0, 2).map((d) => d.value).join(' • ');
          return (
            <View key={fab.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
              <View className="flex-row items-center gap-3 flex-1">
                <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                  <ChefHat size={18} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-xs font-black text-gray-900 uppercase">{fab.name}</Text>
                  <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5" numberOfLines={1}>
                    {format(new Date(fab.timestamp), 'HH:mm', { locale: fr })}
                    {fab.typeLabel ? ` • ${fab.typeLabel}` : ''}
                    {summary ? ` • ${summary}` : ''}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => startEdit(fab)} className="w-9 h-9 rounded-xl bg-gray-50 items-center justify-center">
                <Pencil size={14} color="#9CA3AF" />
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
