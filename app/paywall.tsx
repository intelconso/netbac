import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import type { PurchasesPackage } from 'react-native-purchases';
import { ArrowLeft, Check, Lock, ShieldCheck } from 'lucide-react-native';
import { useAccess, afterPurchase, setSimulatedAccess, SimulatedAccess } from '../src/lib/access';
import { buy, hasPro, monthlyPackage, purchasesAvailable, restore } from '../src/lib/purchases';
import { TRIAL_DAYS } from '../src/lib/subscription';
import { formatDate } from '../src/lib/utils';

const FEATURES = [
  'Étiquettes et traçabilité illimitées',
  'Relevés de températures, nettoyage, nuisibles',
  'Tâches d’équipe, photos et rappels',
  'Inventaire, courses et notes partagées',
  'Rapports PDF pour les contrôles sanitaires',
  'Synchronisation sur tous les téléphones du restaurant',
];

type Legal = { termsUrl?: string; privacyUrl?: string };
const legal = (Constants.expoConfig?.extra?.legal ?? {}) as Legal;

export default function PaywallScreen() {
  const router = useRouter();
  const access = useAccess((s) => s.access);
  const managementURL = useAccess((s) => s.managementURL);

  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(purchasesAvailable());
  const [busy, setBusy] = useState<null | 'buy' | 'restore'>(null);

  useEffect(() => {
    if (!purchasesAvailable()) return;
    let alive = true;
    monthlyPackage()
      .then((p) => { if (alive) setPkg(p); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const subscribed = access.kind === 'active' || access.kind === 'comp';

  const onBuy = async () => {
    if (!pkg) return;
    setBusy('buy');
    const res = await buy(pkg);
    setBusy(null);
    if (res.ok) {
      if (hasPro(res.info)) afterPurchase();
      Alert.alert('Merci !', 'Votre abonnement est actif.', [{ text: 'OK', onPress: () => router.back() }]);
    } else if (!res.cancelled) {
      Alert.alert('Achat impossible', res.error ?? 'Réessayez dans un instant.');
    }
  };

  const onRestore = async () => {
    setBusy('restore');
    try {
      const info = await restore();
      if (hasPro(info)) {
        afterPurchase();
        Alert.alert('Abonnement restauré', 'Votre abonnement est de nouveau actif.');
      } else {
        Alert.alert('Aucun abonnement', 'Aucun abonnement actif n’a été trouvé pour ce compte store.');
      }
    } catch (e: any) {
      Alert.alert('Restauration impossible', e?.message ?? 'Réessayez dans un instant.');
    } finally {
      setBusy(null);
    }
  };

  let headline: string;
  let subline: string;
  switch (access.kind) {
    case 'trial':
      headline = `Essai gratuit : ${access.daysLeft} jour${access.daysLeft > 1 ? 's' : ''} restant${access.daysLeft > 1 ? 's' : ''}`;
      subline = `Jusqu’au ${formatDate(access.endsAt)}. Abonnez-vous quand vous voulez, sans rien perdre.`;
      break;
    case 'expired':
      if (access.reason === 'trial-used') {
        headline = 'Essai déjà utilisé sur ce téléphone';
        subline = 'L’essai gratuit est d’un par téléphone, et celui-ci en a déjà profité avec un autre compte. Abonnez-vous pour commencer, ou reconnectez-vous au compte de votre restaurant.';
        break;
      }
      headline = 'Votre essai gratuit est terminé';
      subline = 'Vos données sont conservées et restent consultables : historique, rapports et exports PDF. Abonnez-vous pour reprendre la saisie.';
      break;
    case 'active':
      headline = 'Abonnement actif';
      subline = 'Merci ! Toutes les fonctionnalités sont disponibles.';
      break;
    case 'comp':
      headline = 'Accès offert';
      subline = 'Ce compte dispose d’un accès complet offert.';
      break;
    default:
      headline = `${TRIAL_DAYS} jours d’essai gratuit`;
      subline = 'Vérification de votre abonnement…';
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <Text className="text-sm font-black text-gray-900 uppercase flex-1">Abonnement</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <View className="items-center mb-6">
          <View className={`w-16 h-16 rounded-3xl items-center justify-center ${access.kind === 'expired' ? 'bg-red-50' : 'bg-primary'}`}>
            {access.kind === 'expired'
              ? <Lock size={30} color="#EF4444" />
              : <ShieldCheck size={30} color="#fff" />}
          </View>
          <Text className="text-xl font-black text-gray-900 text-center mt-4">{headline}</Text>
          <Text className="text-sm text-gray-500 text-center mt-2 leading-5">{subline}</Text>
        </View>

        <View className="bg-white rounded-3xl p-5 border border-gray-100 mb-6">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">NETBAC complet</Text>
          {FEATURES.map((f) => (
            <View key={f} className="flex-row items-center gap-3 py-1.5">
              <Check size={16} color="#10B981" />
              <Text className="text-sm text-gray-800 flex-1">{f}</Text>
            </View>
          ))}
        </View>

        {subscribed ? (
          managementURL ? (
            <Pressable
              onPress={() => Linking.openURL(managementURL)}
              className="h-14 rounded-2xl bg-white border border-gray-200 items-center justify-center"
            >
              <Text className="text-sm font-black text-gray-900 uppercase">Gérer mon abonnement</Text>
            </Pressable>
          ) : null
        ) : !purchasesAvailable() ? (
          <View className="h-14 rounded-2xl bg-gray-100 items-center justify-center">
            <Text className="text-sm font-black text-gray-400 uppercase">Abonnement bientôt disponible</Text>
          </View>
        ) : loading ? (
          <View className="h-14 items-center justify-center"><ActivityIndicator color="#10B981" /></View>
        ) : pkg ? (
          <>
            <Pressable
              onPress={onBuy}
              disabled={busy !== null}
              className="h-14 rounded-2xl bg-primary items-center justify-center"
            >
              {busy === 'buy'
                ? <ActivityIndicator color="#fff" />
                : <Text className="text-sm font-black text-white uppercase">
                    S’abonner — {pkg.product.priceString} / mois
                  </Text>}
            </Pressable>
            <Text className="text-[11px] text-gray-400 text-center mt-3 leading-4">
              Abonnement mensuel renouvelé automatiquement au prix de {pkg.product.priceString}, sauf résiliation
              au moins 24 h avant la fin de la période en cours, depuis les réglages de votre compte store.
            </Text>
          </>
        ) : (
          <View className="h-14 rounded-2xl bg-gray-100 items-center justify-center">
            <Text className="text-sm font-black text-gray-400 uppercase">Offre indisponible pour le moment</Text>
          </View>
        )}

        {purchasesAvailable() && access.kind !== 'comp' ? (
          <Pressable onPress={onRestore} disabled={busy !== null} className="h-12 items-center justify-center mt-3">
            {busy === 'restore'
              ? <ActivityIndicator color="#9CA3AF" />
              : <Text className="text-xs font-black text-gray-500 uppercase">Restaurer mes achats</Text>}
          </Pressable>
        ) : null}

        {(legal.termsUrl || legal.privacyUrl) ? (
          <View className="flex-row justify-center gap-6 mt-4">
            {legal.termsUrl ? (
              <Pressable onPress={() => Linking.openURL(legal.termsUrl!)}>
                <Text className="text-[11px] text-gray-400 underline">Conditions d’utilisation</Text>
              </Pressable>
            ) : null}
            {legal.privacyUrl ? (
              <Pressable onPress={() => Linking.openURL(legal.privacyUrl!)}>
                <Text className="text-[11px] text-gray-400 underline">Confidentialité</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {__DEV__ ? <DevSimulator /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const SIM_OPTIONS: { id: SimulatedAccess | null; label: string }[] = [
  { id: null, label: 'Réel' },
  { id: 'trial-25', label: 'Essai 25 j' },
  { id: 'trial-3', label: 'Essai 3 j' },
  { id: 'expired', label: 'Expiré' },
  { id: 'trial-used', label: 'Essai déjà pris' },
  { id: 'active', label: 'Abonné' },
];

// Développement uniquement : force l'état d'abonnement côté app.
function DevSimulator() {
  const simulated = useAccess((s) => s.simulated);
  return (
    <View className="mt-10 p-4 rounded-2xl border border-dashed border-gray-300">
      <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">
        Simulateur (dev uniquement)
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {SIM_OPTIONS.map((o) => {
          const on = simulated === o.id;
          return (
            <Pressable
              key={o.label}
              onPress={() => setSimulatedAccess(o.id)}
              className={`px-3 py-2 rounded-xl border ${on ? 'bg-gray-900 border-gray-900' : 'bg-white border-gray-200'}`}
            >
              <Text className={`text-[11px] font-black uppercase ${on ? 'text-white' : 'text-gray-600'}`}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-[10px] text-gray-400 mt-3 leading-4">
        Agit sur l’app seulement, rien n’est écrit sur le serveur. Remis à « Réel » au rechargement.
      </Text>
    </View>
  );
}
