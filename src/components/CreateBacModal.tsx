import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { ContainerType } from '../types';

const BAC_TYPES: { key: ContainerType; label: string }[] = [
  { key: 'bac', label: 'Bac' },
  { key: 'boite', label: 'Boîte' },
  { key: 'tiroir', label: 'Tiroir' },
];

type Props = {
  shelfId: string | null;
  onClose: () => void;
  onSubmit: (shelfId: string, name: string, type: ContainerType) => void;
};

export default function CreateBacModal({ shelfId, onClose, onSubmit }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ContainerType>('bac');

  const reset = () => { setName(''); setType('bac'); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!shelfId || !name.trim()) return;
    onSubmit(shelfId, name.trim(), type);
    reset();
  };

  return (
    <Modal visible={!!shelfId} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl p-8 gap-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">Nouveau Contenant</Text>
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Bac, boîte, tiroir...</Text>
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
              placeholder="Ex : Poulet"
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900"
            />
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</Text>
            <View className="flex-row gap-2">
              {BAC_TYPES.map((t) => (
                <Pressable
                  key={t.key}
                  onPress={() => setType(t.key)}
                  className={`flex-1 px-3 py-3 rounded-xl ${type === t.key ? 'bg-primary' : 'bg-gray-50'}`}
                >
                  <Text className={`text-[10px] font-black uppercase text-center ${type === t.key ? 'text-white' : 'text-gray-700'}`}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!name.trim()}
            className={`py-4 rounded-2xl ${name.trim() ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <Text className={`font-black uppercase text-xs text-center ${name.trim() ? 'text-white' : 'text-gray-400'}`}>Créer le contenant</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
