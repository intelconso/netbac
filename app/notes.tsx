import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, TextInput, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Send, StickyNote, Trash2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useActiveStore } from '../src/lib/useActive';
import { useStore } from '../src/lib/store';
import { cn } from '../src/lib/utils';
import {
  NOTE_PAPER, NOTE_TTL_DAYS, lastNoteEmployeeId, noteTimeLabel, visibleNotes,
} from '../src/lib/notes';

// Notes — le panneau de liège de l'équipe.
//
// Ce n'est PAS le registre : rien de ce qui est écrit ici n'entre dans un
// rapport HACCP, ne signe un contrôle ni ne s'imprime. Pour ça, il y a les
// remarques de la journée dans Traçabilité. Ici on se laisse des notes.
//
// Deux choses portent tout l'écran :
//
//  - « Qui êtes-vous ? » est demandé UNE fois, en haut, avant d'écrire — pas à
//    chaque note. Tous les téléphones du restaurant sont sur le même compte
//    Google, donc l'app ne peut pas deviner qui tape : elle le demande, comme
//    le pas-à-pas des tâches.
//  - Le champ est en BAS, au-dessus du clavier. On vient ici pour lire les
//    notes des autres bien plus souvent que pour en écrire une.

export default function NotesScreen() {
  const router = useRouter();
  const { notes, employees } = useActiveStore();
  const addNote = useStore((s) => s.addNote);
  const deleteNote = useStore((s) => s.deleteNote);

  const [text, setText] = useState('');
  // La personne présélectionnée est celle qui a écrit la dernière note : sur un
  // poste partagé c'est presque toujours la même deux fois de suite.
  const [pickedId, setPickedId] = useState<string | undefined>(() => {
    const last = lastNoteEmployeeId(notes);
    return last && employees.some((e) => e.id === last) ? last : employees[0]?.id;
  });

  const visible = useMemo(() => visibleNotes(notes), [notes]);
  const employee = employees.find((e) => e.id === pickedId);
  const canPost = !!employee && text.trim().length > 0;

  const post = () => {
    if (!employee) return;
    const t = text.trim();
    if (!t) return;
    addNote({ text: t, employeeId: employee.id, authorName: employee.name });
    setText('');
  };

  const confirmDelete = (id: string, preview: string) => {
    Alert.alert(
      'Retirer cette note ?',
      preview.length > 60 ? `${preview.slice(0, 60)}…` : preview,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Retirer', style: 'destructive', onPress: () => deleteNote(id) },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-sm font-black text-gray-900 uppercase">Notes</Text>
            <Text className="text-[9px] font-bold text-primary uppercase tracking-widest mt-0.5">
              {visible.length > 0
                ? `${visible.length} note${visible.length > 1 ? 's' : ''} au tableau`
                : 'Aucune note'}
            </Text>
          </View>
        </View>
      </View>

      {/* `padding` sur les DEUX plateformes, et pas `undefined` sur Android
          comme ailleurs dans l'app. Depuis l'edge-to-edge (Expo 54), Android
          ne rétrécit plus la fenêtre sous le clavier malgré `adjustResize` :
          l'app dessine dessous, et un champ collé en bas se retrouve caché
          derrière les touches. Les autres écrans ne s'en aperçoivent pas —
          leurs champs sont dans la liste déroulante, pas en barre fixe. */}
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 24, gap: 12 }}
          keyboardShouldPersistTaps="handled"
        >
          {visible.length === 0 ? (
            <View className="items-center gap-3 py-16">
              <View className="w-16 h-16 rounded-3xl bg-gray-50 items-center justify-center">
                <StickyNote size={26} color="#D1D5DB" />
              </View>
              <Text className="text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">
                Le tableau est vide
              </Text>
              <Text className="text-[11px] font-medium text-gray-400 text-center px-8">
                Laissez une note à l'équipe — elle apparaît sur tous les téléphones du restaurant.
              </Text>
            </View>
          ) : (
            visible.map((n) => (
              <View
                key={n.id}
                className="rounded-3xl border p-4 gap-3"
                style={{ backgroundColor: NOTE_PAPER.bg, borderColor: NOTE_PAPER.border }}
              >
                <Text className="text-sm font-medium text-gray-900 leading-5">{n.text}</Text>
                <View className="flex-row items-center gap-2">
                  <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: NOTE_PAPER.accent }} />
                  <Text className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex-1" numberOfLines={1}>
                    {n.authorName} · {noteTimeLabel(n.createdAt)}
                  </Text>
                  <Pressable
                    onPress={() => confirmDelete(n.id, n.text)}
                    hitSlop={8}
                    className="w-8 h-8 rounded-xl bg-white/60 items-center justify-center"
                  >
                    <Trash2 size={13} color="#9CA3AF" />
                  </Pressable>
                </View>
              </View>
            ))
          )}

          {visible.length > 0 && (
            <Text className="text-[9px] font-bold text-gray-300 uppercase tracking-widest text-center mt-2">
              Une note s'efface toute seule après {NOTE_TTL_DAYS} jours
            </Text>
          )}
        </ScrollView>

        {/* Rédaction — collée en bas, au-dessus du clavier. */}
        <View className="px-6 pt-3 pb-4 bg-white border-t border-gray-50 gap-3">
          {employees.length === 0 ? (
            <View className="bg-alert/10 border border-alert/30 rounded-2xl p-4 gap-3">
              <Text className="text-[11px] font-medium text-gray-600">
                Aucun membre d'équipe enregistré. Ajoutez-en dans Paramètres → Personnalisation → Équipe
                pour pouvoir signer une note.
              </Text>
              <Pressable
                onPress={() => router.push('/(tabs)/settings' as any)}
                className="py-3 bg-primary rounded-xl"
              >
                <Text className="text-[10px] font-black text-white uppercase text-center">Ouvrir les paramètres</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View className="gap-2">
                <Text className="text-[9px] font-bold text-gray-400 uppercase">Qui êtes-vous ?</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View className="flex-row gap-2 pr-2">
                    {employees.map((e) => (
                      <Pressable
                        key={e.id}
                        onPress={() => setPickedId(e.id)}
                        className={cn(
                          'px-4 py-2.5 rounded-xl border',
                          pickedId === e.id ? 'bg-primary/10 border-primary' : 'bg-gray-50 border-gray-100'
                        )}
                      >
                        <Text className={cn('text-[11px] font-black uppercase', pickedId === e.id ? 'text-primary' : 'text-gray-600')}>
                          {e.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View className="flex-row items-end gap-2">
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Une note pour l'équipe…"
                  placeholderTextColor="#D1D5DB"
                  multiline
                  className="flex-1 px-4 py-3 bg-gray-50 rounded-2xl text-sm font-medium text-gray-900"
                  style={{ maxHeight: 110, minHeight: 44 }}
                />

                <Pressable
                  onPress={post}
                  disabled={!canPost}
                  className={cn(
                    'w-11 h-11 rounded-2xl items-center justify-center',
                    canPost ? 'bg-primary' : 'bg-gray-100'
                  )}
                >
                  <Send size={17} color={canPost ? '#FFFFFF' : '#D1D5DB'} />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
