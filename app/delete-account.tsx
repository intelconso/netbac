import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Trash2 } from 'lucide-react-native';
import { auth } from '../src/lib/firebase';
import { useAccess } from '../src/lib/access';
import { deleteAccount, prettifyDeleteError, signInMethod } from '../src/lib/deleteAccount';

const STORE_SUBSCRIPTIONS_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  default: 'https://play.google.com/store/account/subscriptions',
});

export default function DeleteAccountScreen() {
  const router = useRouter();
  const user = auth.currentUser;
  const method = signInMethod(user);
  const access = useAccess((s) => s.access);
  const managementURL = useAccess((s) => s.managementURL);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmLabel =
    method === 'apple' ? 'Apple va vous demander de confirmer votre identité.'
    : method === 'google' ? 'Google va vous demander de confirmer votre compte.'
    : 'Saisissez votre mot de passe pour confirmer.';

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteAccount({ password });
      // L'AuthGate renvoie à la connexion dès que le compte n'existe plus.
    } catch (e: any) {
      const msg = prettifyDeleteError(e);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    if (method === 'password' && !password) {
      setError('Mot de passe requis.');
      return;
    }
    Alert.alert(
      'Supprimer définitivement ?',
      'Toutes les données du restaurant seront effacées pour TOUS les téléphones connectés à ce compte. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: run },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 bg-white border-b border-gray-50">
        <View className="flex-row items-center gap-4">
          <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-xl bg-gray-50 items-center justify-center">
            <ArrowLeft size={20} color="#9CA3AF" />
          </Pressable>
          <Text className="text-sm font-black text-gray-900 uppercase flex-1">Supprimer le compte</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
        <View className="items-center mb-6">
          <View className="w-16 h-16 rounded-3xl items-center justify-center bg-red-50">
            <Trash2 size={30} color="#EF4444" />
          </View>
          <Text className="text-xl font-black text-gray-900 text-center mt-4">Supprimer votre compte</Text>
          {user?.email ? <Text className="text-sm text-gray-500 text-center mt-2">{user.email}</Text> : null}
        </View>

        <View className="bg-white p-5 rounded-2xl border border-gray-100 gap-3">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ce qui sera effacé</Text>
          <Text className="text-sm text-gray-700 leading-5">
            • Tout l’état du restaurant : structure, étiquettes, relevés, tâches, inventaire, courses, notes.{'\n'}
            • Pour tous les téléphones connectés à ce compte, pas seulement celui-ci.{'\n'}
            • Votre compte de connexion.
          </Text>
          <Text className="text-sm text-gray-700 leading-5">
            Pensez à exporter vos rapports HACCP avant : ils ne pourront plus être générés.
          </Text>
        </View>

        {access.kind === 'active' ? (
          <View className="bg-amber-50 p-5 rounded-2xl border border-amber-100 gap-3 mt-4">
            <Text className="text-sm text-amber-800 leading-5 font-bold">
              Supprimer le compte ne résilie pas votre abonnement. Résiliez-le d’abord dans{' '}
              {Platform.OS === 'ios' ? 'l’App Store' : 'Google Play'}, sinon il continuera d’être facturé.
            </Text>
            <Pressable onPress={() => Linking.openURL(managementURL || STORE_SUBSCRIPTIONS_URL!)}>
              <Text className="text-xs font-black text-amber-900 uppercase">Gérer mon abonnement</Text>
            </Pressable>
          </View>
        ) : null}

        <Text className="text-xs text-gray-500 mt-6 mb-2">{confirmLabel}</Text>
        {method === 'password' ? (
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Mot de passe"
            className="bg-white rounded-2xl px-4 py-3 border border-gray-100 text-gray-900 mb-2"
          />
        ) : null}

        {error ? (
          <View className="bg-danger/10 border border-danger/20 px-4 py-3 rounded-2xl mb-2">
            <Text className="text-[11px] font-bold text-danger">{error}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={onDelete}
          disabled={busy}
          className={`py-4 rounded-2xl mt-2 ${busy ? 'bg-red-300' : 'bg-red-500'}`}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text className="text-white font-black uppercase text-xs text-center">Supprimer définitivement</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
