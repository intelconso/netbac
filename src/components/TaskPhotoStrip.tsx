import React, { useState } from 'react';
import { View, Text, Image, Pressable, Modal } from 'react-native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CloudUpload, X } from 'lucide-react-native';
import { TaskPhoto } from '../types';
import { useActiveStore } from '../lib/useActive';
import { cn } from '../lib/utils';

// Les photos d'un cochage : vignettes en grille, et un aperçu plein écran au
// tap — une preuve qu'on ne peut pas lire ne prouve rien, donc la vignette
// n'est jamais un cul-de-sac.
//
// La source d'une photo est soit son URL Cloudinary, soit — sur l'appareil qui
// vient de la prendre — le fichier local encore en file d'attente. Même
// résolution que ProductLabel : l'employé voit sa photo immédiatement, y
// compris hors ligne. Sur un AUTRE appareil, une photo pas encore envoyée n'a
// aucune source : on affiche une tuile « envoi en attente » plutôt qu'un trou,
// pour que le nombre de photos annoncé reste vrai.
interface Resolved {
  photo: TaskPhoto;
  uri?: string;
  pending: boolean;
}

function useResolved(photos: TaskPhoto[]): Resolved[] {
  const { pendingPhotos } = useActiveStore();
  return photos.map((photo) => {
    const local = pendingPhotos?.find((p) => p.taskPhotoId === photo.id)?.localPath;
    return { photo, uri: photo.url ?? local, pending: !photo.url };
  });
}

interface TaskPhotoStripProps {
  photos: TaskPhoto[];
  size?: 'sm' | 'lg';
}

export default function TaskPhotoStrip({ photos, size = 'sm' }: TaskPhotoStripProps) {
  const resolved = useResolved(photos);
  const [viewing, setViewing] = useState<number | null>(null);

  if (resolved.length === 0) return null;

  const tile = size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  const current = viewing !== null ? resolved[viewing] : undefined;

  return (
    <>
      <View className="flex-row flex-wrap gap-2">
        {resolved.map((r, i) => (
          <Pressable
            key={r.photo.id}
            onPress={() => r.uri && setViewing(i)}
            disabled={!r.uri}
            className="relative"
          >
            {r.uri ? (
              <Image source={{ uri: r.uri }} className={cn('rounded-xl bg-gray-100', tile)} />
            ) : (
              <View className={cn('rounded-xl bg-gray-100 items-center justify-center', tile)}>
                <CloudUpload size={16} color="#9CA3AF" />
              </View>
            )}
            {r.pending && (
              <View
                className="absolute -top-1 -right-1 rounded-full bg-amber-400 border border-white"
                style={{ width: 12, height: 12 }}
              />
            )}
          </Pressable>
        ))}
      </View>

      <Modal visible={viewing !== null} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <View className="flex-1 bg-black/95">
          <Pressable onPress={() => setViewing(null)} className="flex-1 items-center justify-center p-4">
            {current?.uri && (
              <Image source={{ uri: current.uri }} className="w-full h-4/5" resizeMode="contain" />
            )}
          </Pressable>

          <Pressable
            onPress={() => setViewing(null)}
            className="absolute top-14 right-6 w-11 h-11 rounded-full bg-white/15 items-center justify-center"
          >
            <X size={24} color="#fff" />
          </Pressable>

          {current && (
            <View className="absolute top-14 left-6">
              <Text className="text-[10px] font-black text-white uppercase tracking-widest">
                {current.photo.operatorName}
              </Text>
              <Text className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                {format(new Date(current.photo.capturedAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                {current.pending ? ' • envoi en attente' : ''}
              </Text>
            </View>
          )}

          {/* Navigation entre les photos du même cochage — un cochage peut en
              porter plusieurs, refermer pour ouvrir la suivante serait pénible. */}
          {resolved.length > 1 && viewing !== null && (
            <View className="absolute bottom-16 left-0 right-0 flex-row items-center justify-center gap-6">
              <Pressable
                disabled={viewing === 0}
                onPress={() => setViewing((v) => (v === null ? v : Math.max(0, v - 1)))}
                className={cn('w-12 h-12 rounded-full bg-white/15 items-center justify-center', viewing === 0 && 'opacity-30')}
              >
                <ChevronLeft size={22} color="#fff" />
              </Pressable>
              <Text className="text-[11px] font-black text-white uppercase tracking-widest">
                {viewing + 1} / {resolved.length}
              </Text>
              <Pressable
                disabled={viewing === resolved.length - 1}
                onPress={() => setViewing((v) => (v === null ? v : Math.min(resolved.length - 1, v + 1)))}
                className={cn(
                  'w-12 h-12 rounded-full bg-white/15 items-center justify-center',
                  viewing === resolved.length - 1 && 'opacity-30'
                )}
              >
                <ChevronRight size={22} color="#fff" />
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}
