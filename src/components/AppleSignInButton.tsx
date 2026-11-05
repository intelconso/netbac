import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { appleSignInAvailable, isAppleCancel, signInWithApple } from '../lib/appleSignIn';

// Bouton officiel d'Apple (ses règles imposent ce dessin, et une place au
// moins aussi visible que Google). Ne rend rien hors iOS.
export function AppleSignInButton({
  onSuccess,
  onError,
  disabled,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  disabled?: boolean;
}) {
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') appleSignInAvailable().then(setAvailable);
  }, []);

  if (!available) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Apple = require('expo-apple-authentication');

  const onPress = async () => {
    if (disabled || loading) return;
    setLoading(true);
    try {
      await signInWithApple();
      onSuccess();
    } catch (e: any) {
      if (!isAppleCancel(e)) onError(e?.message || 'Échec de la connexion Apple.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="h-[52px] rounded-2xl bg-black items-center justify-center">
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return (
    <Apple.AppleAuthenticationButton
      buttonType={Apple.AppleAuthenticationButtonType.CONTINUE}
      buttonStyle={Apple.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={16}
      style={{ height: 52, width: '100%' }}
      onPress={onPress}
    />
  );
}
