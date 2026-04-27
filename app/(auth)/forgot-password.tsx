import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, ArrowLeft, MailCheck } from 'lucide-react-native';
import { sendPasswordReset } from '../../src/lib/firebase';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim()) {
      setError('Email requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e: any) {
      setError(prettifyAuthError(e?.code, e?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-8 pb-8">
        <Pressable onPress={() => router.back()} className="self-start mb-6 -ml-2 p-2">
          <ArrowLeft size={20} color="#9CA3AF" />
        </Pressable>

        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 bg-primary rounded-2xl items-center justify-center">
            <ShieldCheck size={26} color="#fff" />
          </View>
          <View>
            <Text className="text-base font-black text-gray-900 tracking-tighter">NETBAC</Text>
            <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Récupération</Text>
          </View>
        </View>

        <View className="mt-12 gap-2">
          <Text className="text-2xl font-black text-gray-900 uppercase">Mot de passe oublié</Text>
          <Text className="text-xs font-bold text-gray-400">
            Entrez votre email — nous vous enverrons un lien pour le réinitialiser.
          </Text>
        </View>

        {sent ? (
          <View className="mt-12 gap-4 items-center">
            <View className="w-16 h-16 bg-success/10 rounded-2xl items-center justify-center">
              <MailCheck size={32} color="#10B981" />
            </View>
            <Text className="text-base font-black text-gray-900 uppercase text-center">Email envoyé</Text>
            <Text className="text-xs font-bold text-gray-400 text-center px-4">
              Vérifiez votre boîte de réception (et les spams). Le lien expire dans une heure.
            </Text>
            <Pressable
              onPress={() => router.replace('/login' as any)}
              className="bg-primary px-8 py-4 rounded-2xl mt-4"
            >
              <Text className="text-white font-black uppercase text-xs">Retour à la connexion</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-8 gap-4">
            <View className="gap-2">
              <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="vous@restaurant.com"
                className="bg-white rounded-2xl px-4 py-3 border border-gray-100 text-gray-900"
              />
            </View>

            {error && (
              <View className="bg-danger/10 border border-danger/20 px-4 py-3 rounded-2xl">
                <Text className="text-[11px] font-bold text-danger">{error}</Text>
              </View>
            )}

            <Pressable
              onPress={onSubmit}
              disabled={submitting}
              className={`py-4 rounded-2xl mt-2 ${submitting ? 'bg-primary/60' : 'bg-primary'}`}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white font-black uppercase text-xs text-center">Envoyer le lien</Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function prettifyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'Email invalide.';
    case 'auth/user-not-found': return 'Aucun compte trouvé pour cet email.';
    case 'auth/network-request-failed': return 'Pas de connexion réseau.';
    case 'auth/too-many-requests': return 'Trop de tentatives. Réessayez plus tard.';
    default: return fallback || 'Une erreur est survenue.';
  }
}
