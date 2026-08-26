import React from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import { TaskPhoto } from '../types';
import TaskPhotoStrip from './TaskPhotoStrip';

// Le bloc « Photos » d'un cochage — identique dans la feuille de la vue liste
// et dans la carte du pas-à-pas.
//
// Deux rangées bien distinctes : au-dessus les photos DÉJÀ attachées (sans
// croix, elles sont définitives — voir TaskPhoto), en dessous les brouillons de
// la saisie en cours, qu'on peut encore jeter.
interface TaskPhotoPickerProps {
  existing: TaskPhoto[];
  drafts: string[];
  busy: boolean;
  error: string | null;
  onAdd: (source: 'camera' | 'library') => void;
  onDrop: (path: string) => void;
}

export default function TaskPhotoPicker({
  existing, drafts, busy, error, onAdd, onDrop,
}: TaskPhotoPickerProps) {
  return (
    <View className="gap-2">
      <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Photos <Text className="text-gray-300">(optionnel)</Text>
      </Text>

      {existing.length > 0 && <TaskPhotoStrip photos={existing} />}

      {drafts.length > 0 && (
        <View className="flex-row flex-wrap gap-2">
          {drafts.map((path) => (
            <View key={path} className="relative">
              <Image source={{ uri: path }} className="w-14 h-14 rounded-xl bg-gray-100" />
              <Pressable
                onPress={() => onDrop(path)}
                hitSlop={8}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 items-center justify-center"
              >
                <X size={12} color="#fff" />
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {busy ? (
        <View className="py-4 items-center"><ActivityIndicator color="#10B981" /></View>
      ) : (
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => onAdd('camera')}
            className="flex-1 flex-row items-center justify-center gap-2 bg-white border-2 border-gray-100 py-3 rounded-xl"
          >
            <Camera size={16} color="#10B981" />
            <Text className="text-[10px] font-black text-gray-600 uppercase">Photo</Text>
          </Pressable>
          <Pressable
            onPress={() => onAdd('library')}
            className="flex-1 flex-row items-center justify-center gap-2 bg-white border-2 border-gray-100 py-3 rounded-xl"
          >
            <ImagePlus size={16} color="#10B981" />
            <Text className="text-[10px] font-black text-gray-600 uppercase">Galerie</Text>
          </Pressable>
        </View>
      )}

      {drafts.length > 0 && (
        <Text className="text-[10px] font-medium text-gray-400">
          Une fois enregistrée, une photo ne peut plus être retirée — c'est ce qui en fait une preuve.
        </Text>
      )}
      {error && (
        <Text className="text-[9px] font-bold text-red-500 uppercase tracking-widest">{error}</Text>
      )}
    </View>
  );
}
