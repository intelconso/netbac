import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { StorageUnit } from '../types';

const UNIT_TYPES: { key: StorageUnit['type']; label: string }[] = [
  { key: 'frigo', label: 'Frigo' },
  { key: 'congelateur', label: 'Congélateur' },
  { key: 'reserve', label: 'Réserve' },
  { key: 'saladette', label: 'Saladette' },
  { key: 'autre', label: 'Autre' },
];

type Props = {
  zoneId: string | null;
  onClose: () => void;
  onSubmit: (zoneId: string, name: string, type: StorageUnit['type']) => void;
};

export default function CreateUnitModal({ zoneId, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<StorageUnit['type']>('frigo');

  const reset = () => { setName(''); setType('frigo'); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!zoneId || !name.trim()) return;
    onSubmit(zoneId, name.trim(), type);
    reset();
  };

  return (
    <Modal visible={!!zoneId} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl p-8 gap-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">Nouveau Support</Text>
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Frigo, réserve, etc.</Text>
            </View>
            <Pressable onPress={handleClose} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex : Frigo 1"
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900"
            />
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {UNIT_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setType(t.key)}
                  className={`px-3 py-2 rounded-xl ${type === t.key ? 'bg-primary' : 'bg-gray-50'}`}
                >
                  <Text className={`text-[10px] font-black uppercase ${type === t.key ? 'text-white' : 'text-gray-700'}`}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!name.trim()}
            className={`py-4 rounded-2xl ${name.trim() ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <Text className={`font-black uppercase text-xs text-center ${name.trim() ? 'text-white' : 'text-gray-400'}`}>Créer le support</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
