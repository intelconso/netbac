import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Scan, X, LogOut } from 'lucide-react-native';
import { useStore } from '../../src/lib/store';
import { StorageUnit } from '../../src/types';
import { signOut } from '../../src/lib/firebase';
import { signOutGoogle } from '../../src/lib/googleSignIn';
import { useSession } from '../../src/lib/useSession';

const ZONE_ICONS = ['👨‍🍳', '🍸', '📦', '🧊', '🥗', '🍷', '🧂', '🍽️'];
const UNIT_ICONS = ['❄️', '🧊', '🥫', '🍷', '🥶', '🧯', '📦', '🛒'];
const UNIT_TYPES: { key: StorageUnit['type']; label: string }[] = [
  { key: 'frigo', label: 'Frigo' },
  { key: 'congelateur', label: 'Congélateur' },
  { key: 'reserve', label: 'Réserve' },
  { key: 'saladette', label: 'Saladette' },
  { key: 'autre', label: 'Autre' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useSession();
  const { zones, storageUnits, bacs, shelves, addZone, addStorageUnit } = useStore();

  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [unitModalZoneId, setUnitModalZoneId] = useState<string | null>(null);

  const handleSignOut = () => {
    Alert.alert('Se déconnecter ?', 'Vous serez redirigé vers la page de connexion.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnexion',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutGoogle();
            await signOut();
          } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de se déconnecter.');
          }
        },
      },
    ]);
  };

  return (
    <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 24, paddingBottom: 96 }}>
      <View className="flex-row justify-between items-start">
        <View>
          <Text className="text-xs font-black text-primary uppercase tracking-widest">NETBAC</Text>
          <Text className="text-xl font-black text-gray-900 uppercase mt-0.5">Tableau de Bord</Text>
          {user?.email && (
            <Text className="text-[10px] font-bold text-gray-400 mt-1">{user.email}</Text>
          )}
        </View>
        <Pressable onPress={handleSignOut} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center active:bg-gray-100">
          <LogOut size={16} color="#9CA3AF" />
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/express-add')} className="bg-primary p-6 rounded-3xl mt-8">
        <View className="flex-row items-center gap-5">
          <View className="w-14 h-14 rounded-2xl bg-white/20 items-center justify-center">
            <Plus size={32} color="#fff" />
          </View>
          <View>
            <Text className="text-xl font-black text-white uppercase">Étiquetage</Text>
            <Text className="text-[9px] font-black text-white/60 uppercase tracking-widest mt-1">Traçabilité instantanée</Text>
          </View>
          <View className="ml-auto">
            <Scan size={48} color="rgba(255,255,255,0.2)" />
          </View>
        </View>
      </Pressable>

      <View className="mt-8 gap-6">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-bold text-gray-900">Inventaire par Zone</Text>
          <Pressable onPress={() => setZoneModalOpen(true)} className="flex-row items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-xl">
            <Plus size={12} color="#10B981" />
            <Text className="text-[9px] font-black text-primary uppercase">Zone</Text>
          </Pressable>
        </View>

        {zones.map((zone) => {
          const zoneUnits = storageUnits.filter((u) => u.zoneId === zone.id);
          return (
            <View key={zone.id} className="gap-3">
              <View className="flex-row items-center gap-2">
                <Text className="text-sm">{zone.icon}</Text>
                <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{zone.name}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                {zoneUnits.map((unit) => {
                  const unitBacs = bacs.filter((b) => {
                    const shelf = shelves.find((s) => s.id === b.shelfId);
                    return shelf?.unitId === unit.id;
                  });
                  return (
                    <Pressable
                      key={unit.id}
                      onPress={() => router.push(`/unit/${unit.id}` as any)}
                      className="bg-white p-4 rounded-2xl border border-gray-100 items-center gap-2"
                      style={{ minWidth: 120 }}
                    >
                      <View className="w-12 h-12 rounded-xl items-center justify-center bg-gray-50">
                        <Text className="text-2xl">{unit.icon}</Text>
                      </View>
                      <View className="items-center gap-0.5">
                        <Text className="text-xs font-black text-gray-900 uppercase" numberOfLines={1}>{unit.name}</Text>
                        <Text className="text-[8px] font-bold text-primary uppercase">{unitBacs.length} supports</Text>
                        <Text className="text-[7px] font-medium text-gray-400 uppercase">{unit.type}</Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  onPress={() => setUnitModalZoneId(zone.id)}
                  className="bg-white p-4 rounded-2xl border border-dashed border-gray-300 items-center justify-center gap-2"
                  style={{ minWidth: 120 }}
                >
                  <View className="w-12 h-12 rounded-xl items-center justify-center bg-primary/10">
                    <Plus size={24} color="#10B981" />
                  </View>
                  <Text className="text-[9px] font-black text-primary uppercase">Ajouter</Text>
                </Pressable>
              </ScrollView>
            </View>
          );
        })}
      </View>

      <CreateZoneModal
        visible={zoneModalOpen}
        onClose={() => setZoneModalOpen(false)}
        onSubmit={(name, icon) => {
          addZone({ name, icon });
          setZoneModalOpen(false);
        }}
      />

      <CreateUnitModal
        zoneId={unitModalZoneId}
        onClose={() => setUnitModalZoneId(null)}
        onSubmit={(zoneId, name, type, icon) => {
          addStorageUnit({ zoneId, name, type, icon });
          setUnitModalZoneId(null);
        }}
      />
    </ScrollView>
  );
}

function CreateZoneModal({ visible, onClose, onSubmit }: { visible: boolean; onClose: () => void; onSubmit: (name: string, icon: string) => void }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ZONE_ICONS[0]);

  const reset = () => { setName(''); setIcon(ZONE_ICONS[0]); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), icon);
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
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ex : Cuisine"
              className="bg-gray-50 rounded-2xl px-4 py-3 text-gray-900"
            />
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Icône</Text>
            <View className="flex-row flex-wrap gap-2">
              {ZONE_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  className={`w-12 h-12 rounded-xl items-center justify-center ${icon === ic ? 'bg-primary/10 border border-primary' : 'bg-gray-50'}`}
                >
                  <Text className="text-2xl">{ic}</Text>
                </Pressable>
              ))}
            </View>
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

function CreateUnitModal({ zoneId, onClose, onSubmit }: { zoneId: string | null; onClose: () => void; onSubmit: (zoneId: string, name: string, type: StorageUnit['type'], icon: string) => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<StorageUnit['type']>('frigo');
  const [icon, setIcon] = useState(UNIT_ICONS[0]);

  const reset = () => { setName(''); setType('frigo'); setIcon(UNIT_ICONS[0]); };
  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = () => {
    if (!zoneId || !name.trim()) return;
    onSubmit(zoneId, name.trim(), type, icon);
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
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Icône</Text>
            <View className="flex-row flex-wrap gap-2">
              {UNIT_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  onPress={() => setIcon(ic)}
                  className={`w-12 h-12 rounded-xl items-center justify-center ${icon === ic ? 'bg-primary/10 border border-primary' : 'bg-gray-50'}`}
                >
                  <Text className="text-2xl">{ic}</Text>
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
