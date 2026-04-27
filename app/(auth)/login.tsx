import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react-native';
import { signInWithEmail } from '../../src/lib/firebase';
import { signInWithGoogle } from '../../src/lib/googleSignIn';
import { GOOGLE_WEB_CLIENT_ID } from '../../src/lib/authConfig';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      router.replace('/');
    } catch (e: any) {
      setError(prettifyAuthError(e?.code, e?.message));
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    if (!GOOGLE_WEB_CLIENT_ID) {
      Alert.alert('Google Sign-In', 'Configuration Google manquante. Activez-le et collez le Web Client ID dans authConfig.ts.');
      return;
    }
    setGoogleLoading(true);
    setError(null);
    try {
      await signInWithGoogle(GOOGLE_WEB_CLIENT_ID);
      router.replace('/');
    } catch (e: any) {
      setError(e?.message || 'Échec de la connexion Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 px-6 pt-16 pb-8">
        <View className="flex-row items-center gap-3">
          <View className="w-12 h-12 bg-primary rounded-2xl items-center justify-center">
            <ShieldCheck size={26} color="#fff" />
          </View>
          <View>
            <Text className="text-base font-black text-gray-900 tracking-tighter">NETBAC</Text>
            <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Connexion</Text>
          </View>
        </View>

        <View className="mt-12 gap-2">
          <Text className="text-2xl font-black text-gray-900 uppercase">Bon retour</Text>
          <Text className="text-xs font-bold text-gray-400">Connectez-vous pour accéder à votre inventaire.</Text>
        </View>

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
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Mot de passe</Text>
            <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center pr-3">
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                className="flex-1 px-4 py-3 text-gray-900"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} className="p-1">
                {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
              </Pressable>
            </View>
          </View>

          <Link href={'/forgot-password' as any} asChild>
            <Pressable className="self-end">
              <Text className="text-[11px] font-bold text-primary uppercase">Mot de passe oublié ?</Text>
            </Pressable>
          </Link>

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
              <Text className="text-white font-black uppercase text-xs text-center">Se connecter</Text>
            )}
          </Pressable>

          {GOOGLE_WEB_CLIENT_ID ? (
            <>
              <View className="flex-row items-center gap-3 my-2">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ou</Text>
                <View className="flex-1 h-px bg-gray-200" />
              </View>
              <Pressable
                onPress={onGoogle}
                disabled={googleLoading}
                className="py-4 rounded-2xl bg-white border border-gray-200 flex-row items-center justify-center gap-3"
              >
                {googleLoading ? (
                  <ActivityIndicator color="#374151" />
                ) : (
                  <>
                    <Text className="text-base">G</Text>
                    <Text className="text-gray-900 font-black uppercase text-xs">Continuer avec Google</Text>
                  </>
                )}
              </Pressable>
            </>
          ) : null}
        </View>

        <View className="flex-row justify-center gap-1 mt-auto">
          <Text className="text-xs text-gray-400">Pas encore de compte ?</Text>
          <Link href={'/signup' as any} asChild>
            <Pressable>
              <Text className="text-xs font-black text-primary uppercase">Créer un compte</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

function prettifyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'Email invalide.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email ou mot de passe incorrect.';
    case 'auth/too-many-requests': return 'Trop de tentatives. Réessayez plus tard.';
    case 'auth/network-request-failed': return 'Pas de connexion réseau.';
    case 'auth/user-disabled': return 'Ce compte a été désactivé.';
    default: return fallback || 'Une erreur est survenue.';
  }
}
