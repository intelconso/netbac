import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react-native';
import { signUpWithEmail, signOut } from '../../src/lib/firebase';
import { signInWithGoogle } from '../../src/lib/googleSignIn';
import { GOOGLE_WEB_CLIENT_ID } from '../../src/lib/authConfig';

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim()) {
      setError('Le nom est requis.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Email et mot de passe requis.');
      return;
    }
    if (password.length < 6) {
      setError('Mot de passe minimum 6 caractères.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await signUpWithEmail(email, password, name);
      await signOut();
      Alert.alert(
        'Compte créé',
        'Un email de vérification a été envoyé. Connectez-vous pour continuer.'
      );
      router.replace('/login' as any);
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
            <Text className="text-[8px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Inscription</Text>
          </View>
        </View>

        <View className="mt-10 gap-2">
          <Text className="text-2xl font-black text-gray-900 uppercase">Créer un compte</Text>
          <Text className="text-xs font-bold text-gray-400">Configurez votre établissement en 30 secondes.</Text>
        </View>

        <View className="mt-6 gap-4">
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nom</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Votre nom"
              className="bg-white rounded-2xl px-4 py-3 border border-gray-100 text-gray-900"
            />
          </View>
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
                placeholder="Minimum 6 caractères"
                className="flex-1 px-4 py-3 text-gray-900"
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} className="p-1">
                {showPassword ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
              </Pressable>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Confirmer le mot de passe</Text>
            <View className="bg-white rounded-2xl border border-gray-100 flex-row items-center pr-3">
              <TextInput
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
                secureTextEntry={!showPasswordConfirm}
                placeholder="Retapez le mot de passe"
                className="flex-1 px-4 py-3 text-gray-900"
              />
              <Pressable onPress={() => setShowPasswordConfirm((v) => !v)} className="p-1">
                {showPasswordConfirm ? <EyeOff size={18} color="#9CA3AF" /> : <Eye size={18} color="#9CA3AF" />}
              </Pressable>
            </View>
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
              <Text className="text-white font-black uppercase text-xs text-center">Créer le compte</Text>
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
          <Text className="text-xs text-gray-400">Déjà un compte ?</Text>
          <Link href={'/login' as any} asChild>
            <Pressable>
              <Text className="text-xs font-black text-primary uppercase">Se connecter</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

function prettifyAuthError(code?: string, fallback?: string): string {
  switch (code) {
    case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
    case 'auth/invalid-email': return 'Email invalide.';
    case 'auth/weak-password': return 'Mot de passe trop faible.';
    case 'auth/operation-not-allowed': return 'Inscription par email désactivée. Activez Email/Password dans la console Firebase.';
    case 'auth/network-request-failed': return 'Pas de connexion réseau.';
    default: return fallback || 'Une erreur est survenue.';
  }
}
