import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { discardCapturedPhoto, persistTaskPhoto, processPhotoQueue } from './photoQueue';
import { useStore } from './store';
import { ServiceSlot } from '../types';

// Les photos prises pendant qu'on coche une tâche, avant validation.
//
// Un brouillon n'est qu'un fichier local compressé : il se jette librement.
// Il ne devient un TaskPhoto — donc définitif — qu'au moment du `commit`.
// Extrait ici parce que les deux vues (liste et pas-à-pas) doivent se comporter
// exactement pareil : même compression, mêmes règles, même file d'envoi.
export function useTaskPhotoDrafts() {
  const addTaskPhoto = useStore((s) => s.addTaskPhoto);
  const enqueueTaskPhotoUpload = useStore((s) => s.enqueueTaskPhotoUpload);

  const [drafts, setDrafts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Appareil photo ou galerie → compression + copie en local, aucun envoi ici.
  // L'envoi est déféré à la file (photoQueue.ts) : une cuisine sans réseau doit
  // pouvoir photographier quand même.
  const addPhoto = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { setError('Accès caméra refusé.'); return; }
      }
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (result.canceled || !result.assets?.[0]?.uri) return;
      setBusy(true);
      const path = await persistTaskPhoto(result.assets[0].uri);
      setDrafts((d) => [...d, path]);
    } catch (e: any) {
      setError(e?.message ?? "Échec de l'enregistrement de la photo.");
    } finally {
      setBusy(false);
    }
  };

  const dropDraft = (path: string) => {
    setDrafts((d) => d.filter((p) => p !== path));
    discardCapturedPhoto(path).catch(() => {});
  };

  // Abandon : les fichiers n'ont jamais été attachés à quoi que ce soit.
  const discardAll = () => {
    drafts.forEach((path) => { discardCapturedPhoto(path).catch(() => {}); });
    setDrafts([]);
  };

  // Attache les brouillons au passage visé. À partir d'ici ils ne sortent plus.
  const commit = (target: {
    taskId: string;
    dayKey: number;
    service?: ServiceSlot;
    employeeId?: string;
    operatorName: string;
  }) => {
    for (const path of drafts) {
      const id = addTaskPhoto(target);
      enqueueTaskPhotoUpload(id, path);
    }
    if (drafts.length) processPhotoQueue().catch(() => {});
    setDrafts([]);
    setError(null);
  };

  return { drafts, busy, error, addPhoto, dropDraft, discardAll, commit };
}
