import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, CreditCard, Lock } from 'lucide-react-native';
import { useAccess } from '../lib/access';
import { Access } from '../lib/subscription';

export function accessLabel(access: Access): string {
  switch (access.kind) {
    case 'trial': return `Essai gratuit · ${access.daysLeft} j restant${access.daysLeft > 1 ? 's' : ''}`;
    case 'expired': return access.reason === 'trial-used' ? 'Essai déjà utilisé · lecture seule' : 'Essai terminé · lecture seule';
    case 'active': return 'Abonnement actif';
    case 'comp': return 'Accès offert';
    default: return 'Vérification…';
  }
}

// Bandeau du tableau de bord : rien quand tout va bien, discret pendant
// l'essai, rouge une fois en lecture seule.
export function SubscriptionBanner() {
  const router = useRouter();
  const access = useAccess((s) => s.access);
  if (access.kind !== 'trial' && access.kind !== 'expired') return null;

  const expired = access.kind === 'expired';
  const urgent = expired || access.daysLeft <= 7;

  return (
    <Pressable
      onPress={() => router.push('/paywall' as any)}
      className={`p-4 rounded-2xl border flex-row items-center gap-3 ${
        expired ? 'bg-red-50 border-red-100' : urgent ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100'
      }`}
    >
      {expired ? <Lock size={18} color="#EF4444" /> : <CreditCard size={18} color={urgent ? '#D97706' : '#10B981'} />}
      <View className="flex-1">
        <Text className={`text-xs font-black uppercase ${expired ? 'text-red-600' : urgent ? 'text-amber-700' : 'text-gray-900'}`}>
          {accessLabel(access)}
        </Text>
        <Text className="text-[10px] font-bold text-gray-500 mt-0.5">
          {expired ? 'Vos données restent consultables. Abonnez-vous pour saisir.' : 'Voir l’abonnement'}
        </Text>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}

// Ligne des Paramètres : toujours visible, mène à l'écran d'abonnement.
export function SubscriptionRow() {
  const router = useRouter();
  const access = useAccess((s) => s.access);
  const expired = access.kind === 'expired';
  return (
    <Pressable
      onPress={() => router.push('/paywall' as any)}
      className="bg-white p-4 rounded-2xl border border-gray-100 flex-row items-center gap-4"
    >
      <View className={`w-12 h-12 rounded-xl items-center justify-center ${expired ? 'bg-red-50' : 'bg-primary/10'}`}>
        <CreditCard size={20} color={expired ? '#EF4444' : '#10B981'} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-black text-gray-900 uppercase">Abonnement</Text>
        <Text className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${expired ? 'text-red-400' : 'text-gray-400'}`}>
          {accessLabel(access)}
        </Text>
      </View>
      <ChevronRight size={16} color="#D1D5DB" />
    </Pressable>
  );
}
