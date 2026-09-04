import '../global.css';
import React, { Component, ErrorInfo, ReactNode, useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useStore, switchStoreToUser } from '../src/lib/store';
import { rescheduleAllDlcReminders, scheduleTaskDigest, nextReminderOccurrence } from '../src/lib/notifications';
import { pendingTaskCount } from '../src/lib/tasks';
import { startOfDayMs } from '../src/lib/serviceDays';
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
      switchStoreToUser(uid)
        .then(() => {
          if (uid) {
            // Lazy import to keep the auth path independent of Firestore on cold start
            import('../src/lib/sync').then((sync) => sync.startSync(uid));
            import('../src/lib/photoQueue').then((pq) => pq.startPhotoQueue());
          } else {
            import('../src/lib/sync').then((sync) => sync.stopSync());
            import('../src/lib/photoQueue').then((pq) => pq.stopPhotoQueue());
          }
        })
        .catch(() => {});
    }
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) {
      router.replace('/login' as any);
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, initializing, segments]);

  // Render nothing while Firebase determines the cached auth state. Otherwise
  // the router would briefly mount whatever screen the URL points at (often
  // /login) and then redirect once the session resolves — visible flash.
  if (initializing) return null;
  return <>{children}</>;
}

// Marqueur local du rattrapage d'emplacement des articles — voir plus bas.

function RootInner() {
  const products = useStore((s) => s.products);
  const tasks = useStore((s) => s.tasks);
  const taskCompletions = useStore((s) => s.taskCompletions);
  const taskReminderHour = useStore((s) => s.taskReminderHour);
  const closedWeekdays = useStore((s) => s.closedWeekdays);
  const singleServiceWeekdays = useStore((s) => s.singleServiceWeekdays);
  const dayOverrides = useStore((s) => s.dayOverrides);
  const notes = useStore((s) => s.notes);

  useEffect(() => {
    const t = setTimeout(() => {
      rescheduleAllDlcReminders(products).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [products]);

  // Rappel de la checklist d'équipe. Le compte porte sur la journée que la
  // prochaine occurrence de l'heure réglée couvrira — pas forcément aujourd'hui :
  // passé 17h, un rappel réglé à 17h vise demain, et c'est le nombre de tâches
  // de demain qui doit s'afficher. Décalé après les rappels DLC pour ne pas
  // enchaîner deux salves d'appels natifs au démarrage.
  useEffect(() => {
    const t = setTimeout(() => {
      if (taskReminderHour === undefined) {
        scheduleTaskDigest(undefined, 0).catch(() => {});
        return;
      }
      const target = startOfDayMs(nextReminderOccurrence(taskReminderHour).getTime());
      const pending = pendingTaskCount(target, tasks, taskCompletions, {
        closedWeekdays,
        singleServiceWeekdays,
        dayOverrides,
      });
      scheduleTaskDigest(taskReminderHour, pending).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [tasks, taskCompletions, taskReminderHour, closedWeekdays, singleServiceWeekdays, dayOverrides]);

  // Ménage des notes : celles de plus de 30 jours sont enterrées et leur
  // texte jeté. Tout l'état de l'app tient dans UN document Firestore plafonné
  // à 1 Mio — un panneau que personne ne vide finirait par manger ce budget.
  //
  // `purgeExpiredNotes` ne touche à rien quand il n'y a rien à enterrer, donc
  // cet effet peut se rejouer à chaque changement de `notes` sans déclencher de
  // synchro ni boucler sur lui-même. Décalé après les deux salves de rappels,
  // pour la même raison qu'elles sont décalées entre elles.
  useEffect(() => {
    const t = setTimeout(() => { useStore.getState().purgeExpiredNotes(); }, 2500);
    return () => clearTimeout(t);
  }, [notes]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F9FAFB' } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="container/[id]" />
            <Stack.Screen name="unit/[id]" />
            <Stack.Screen name="add-product" />
            <Stack.Screen name="express-add" />
            <Stack.Screen name="journal" />
            <Stack.Screen name="history" />
            <Stack.Screen name="controls-history" />
            <Stack.Screen name="tasks" />
            <Stack.Screen name="reports" />
            <Stack.Screen name="notes" />
            <Stack.Screen name="courses" />
            <Stack.Screen name="courses-catalog" />
            <Stack.Screen name="inventory/index" />
            <Stack.Screen name="inventory/[id]" />
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
