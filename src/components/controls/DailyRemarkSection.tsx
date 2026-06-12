import React, { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { MessageSquare, Pencil, Plus } from 'lucide-react-native';
import { useActiveStore } from '../../lib/useActive';
import { cn } from '../../lib/utils';
import { lastControllerName } from '../../lib/controller';
import { DailyRemark } from '../../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const DAY = 86400000;

// Enregistrement des remarques de la journée — notes libres (dysfonctionnement,
// réclamation client, envoi d'analyses, visite de contrôle, mise en place...).
export default function DailyRemarkSection() {
  const store = useActiveStore();
  const { dailyRemarks, addDailyRemark, updateDailyRemark } = store;

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [controller, setController] = useState('');

  const startOfToday = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); })();
  const today = dailyRemarks
    .filter((r) => r.timestamp >= startOfToday && r.timestamp < startOfToday + DAY)
    .sort((a, b) => b.timestamp - a.timestamp);

  const closeForm = () => {
    setIsAdding(false);
    setEditingId(null);
    setText('');
  };

  const openForm = () => {
    setController(lastControllerName(store));
    setIsAdding(true);
  };

  const startEdit = (r: DailyRemark) => {
    setEditingId(r.id);
    setText(r.text);
    setController(r.operatorName ?? lastControllerName(store));
    setIsAdding(true);
  };

  const canSave = text.trim().length > 0 && controller.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const data = { text: text.trim(), operatorName: controller.trim() };
    if (editingId) updateDailyRemark(editingId, data);
    else addDailyRemark(data);
    closeForm();
  };

  return (
    <View className="gap-4">
      {!isAdding && (
        <Pressable onPress={openForm} className="py-3 bg-primary rounded-xl flex-row items-center justify-center gap-2">
          <Plus size={14} color="#fff" />
          <Text className="text-[10px] font-black text-white uppercase">Nouvelle remarque</Text>
        </Pressable>
      )}

      {isAdding && (
        <View className="bg-white p-4 rounded-2xl border-2 border-primary/20 gap-4">
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            placeholder="Dysfonctionnement, réclamation client, envoi d'analyses, visite de contrôle, nouvelle mise en place..."
            className="p-3 bg-gray-50 rounded-xl text-sm font-bold min-h-[80px]"
          />
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
        {today.map((r) => (
          <View key={r.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center">
                <MessageSquare size={18} color="#6B7280" />
              </View>
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-900">{r.text}</Text>
                <Text className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">
                  {format(new Date(r.timestamp), 'HH:mm', { locale: fr })}
                  {r.operatorName ? ` • ${r.operatorName}` : ''}
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
