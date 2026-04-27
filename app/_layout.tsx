import '../global.css';
import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useStore, switchStoreToUser } from '../src/lib/store';
import { rescheduleAllDlcReminders } from '../src/lib/notifications';
import { useSession } from '../src/lib/useSession';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; info: ErrorInfo | null }> {
  state = { error: null as Error | null, info: null as ErrorInfo | null };

  static getDerivedStateFromError(error: Error) {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={{ flex: 1, backgroundColor: '#FEF2F2', padding: 20, paddingTop: 60 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: '#991B1B', marginBottom: 12 }}>
            NETBAC — erreur au démarrage
          </Text>
          <Text selectable style={{ fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 8 }}>
            {this.state.error.name}: {this.state.error.message}
          </Text>
          <Text selectable style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
            {this.state.error.stack}
          </Text>
          {this.state.info?.componentStack ? (
            <>
              <Text style={{ marginTop: 16, fontSize: 12, fontWeight: '700', color: '#374151' }}>Component stack:</Text>
              <Text selectable style={{ fontSize: 11, color: '#374151', fontFamily: 'monospace' }}>
                {this.state.info.componentStack}
              </Text>
            </>
          ) : null}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

function AuthGate({ children }: { children: ReactNode }) {
  const { user, initializing } = useSession();
  const segments = useSegments();
  const router = useRouter();
  const lastUidRef = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (initializing) return;
    const uid = user?.uid ?? null;
    if (lastUidRef.current !== uid) {
      lastUidRef.current = uid;
      switchStoreToUser(uid).catch(() => {});
    }
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/login' as any);
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, initializing, segments]);

  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' }}>
        <ActivityIndicator color="#10B981" size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

function RootInner() {
  const products = useStore((s) => s.products);

  useEffect(() => {
    const t = setTimeout(() => {
      rescheduleAllDlcReminders(products).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [products]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="bac/[id]" />
            <Stack.Screen name="unit/[id]" />
            <Stack.Screen name="add-product" />
            <Stack.Screen name="express-add" />
            <Stack.Screen name="labels" />
            <Stack.Screen name="journal" />
            <Stack.Screen name="history" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="camera" />
          </Stack>
        </AuthGate>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootInner />
    </ErrorBoundary>
  );
}
