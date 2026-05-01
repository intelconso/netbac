import React, { useState } from 'react';
import { View, Text, Pressable, Modal, TextInput } from 'react-native';
import { X } from 'lucide-react-native';
import { ZoneType } from '../types';
import ZoneIcon, { ZONE_TYPES } from './ZoneIcon';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, type: ZoneType) => void;
};

export default function CreateZoneModal({ visible, onClose, onSubmit }: Props) {
  const [type, setType] = useState<ZoneType>('cuisine');
  const [name, setName] = useState(ZONE_TYPES[0].defaultName);
  const [touchedName, setTouchedName] = useState(false);

  const reset = () => {
    setType('cuisine');
    setName(ZONE_TYPES[0].defaultName);
    setTouchedName(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleTypeSelect = (t: ZoneType) => {
    setType(t);
    if (!touchedName) {
      const def = ZONE_TYPES.find((z) => z.key === t)?.defaultName ?? '';
      setName(def);
    }
  };

  const handleNameChange = (v: string) => {
    setName(v);
    setTouchedName(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), type);
    reset();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="bg-white rounded-t-3xl p-8 gap-6">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-xl font-black uppercase text-gray-900">Nouvelle Zone</Text>
              <Text className="text-[10px] font-bold text-primary uppercase tracking-widest">Ajouter à l'inventaire</Text>
            </View>
            <Pressable onPress={handleClose} className="w-10 h-10 rounded-full bg-gray-50 items-center justify-center">
              <X size={20} color="#9CA3AF" />
            </Pressable>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Type</Text>
            <View className="flex-row flex-wrap gap-2">
              {ZONE_TYPES.map((t) => {
                const active = type === t.key;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => handleTypeSelect(t.key)}
                    className={`px-3 py-2 rounded-xl flex-row items-center gap-2 ${active ? 'bg-primary/10 border border-primary' : 'bg-gray-50 border border-transparent'}`}
                  >
                    <ZoneIcon type={t.key} size={14} color={active ? '#10B981' : '#9CA3AF'} />
                    <Text className={`text-[10px] font-black uppercase ${active ? 'text-primary' : 'text-gray-500'}`}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</Text>
            <TextInput
              value={name}
              onChangeText={handleNameChange}
              placeholder="Ex : Cuisine"
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900"
            />
          </View>
          <Pressable
            onPress={handleSubmit}
            disabled={!name.trim()}
            className={`py-4 rounded-2xl ${name.trim() ? 'bg-primary' : 'bg-gray-200'}`}
          >
            <Text className={`font-black uppercase text-xs text-center ${name.trim() ? 'text-white' : 'text-gray-400'}`}>Créer la zone</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
