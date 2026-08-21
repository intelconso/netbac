import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Product } from '../types';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type NotificationsModule = typeof import('expo-notifications');
let Notifications: NotificationsModule | null = null;

if (!isExpoGo) {
  try {
    Notifications = require('expo-notifications') as NotificationsModule;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {
    Notifications = null;
  }
}

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (!Notifications) return false;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('dlc-alerts', {
      name: 'Alertes DLC',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    });
    await Notifications.setNotificationChannelAsync('task-reminders', {
      name: 'Rappel des tâches',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#F59E0B',
    });
  }
  return status === 'granted';
}

// Chaque notification programmée porte son `kind` dans `content.data`, ce qui
// permet de n'annuler qu'une famille à la fois. C'est indispensable : les
// rappels DLC sont reprogrammés à chaque modification de produit, et un
// cancelAll() global effacerait au passage le rappel des tâches — posé une
// fois, effacé quelques secondes plus tard, jamais reçu.
type NotificationKind = 'dlc' | 'tasks';

async function cancelByKind(kind: NotificationKind, includeUntagged = false): Promise<void> {
  if (!Notifications) return;
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const k = (n.content?.data as { kind?: string } | undefined)?.kind;
    if (k === kind || (includeUntagged && k === undefined)) {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export async function scheduleDlcReminder(product: Product): Promise<string | null> {
  if (!Notifications) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;
  const triggerAt = product.dlc - MS_PER_DAY;
  const now = Date.now();
  if (triggerAt <= now) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: `⏰ DLC proche — ${product.name}`,
      body: `${product.name} expire demain. Vérifiez l'inventaire.`,
      data: { kind: 'dlc', productId: product.id },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerAt),
      channelId: 'dlc-alerts',
    },
  });
  return id;
}

export async function cancelAllDlcReminders(): Promise<void> {
  // includeUntagged : les rappels posés par une version antérieure n'ont pas de
  // `kind` — à l'époque les rappels DLC étaient les seuls à exister.
  await cancelByKind('dlc', true);
}

export async function rescheduleAllDlcReminders(products: Product[]): Promise<number> {
  if (!Notifications) return 0;
  const granted = await ensureNotificationPermissions();
  if (!granted) return 0;
  await cancelAllDlcReminders();
  let scheduled = 0;
  for (const p of products) {
    if (p.status !== 'active') continue;
    const id = await scheduleDlcReminder(p);
    if (id) scheduled++;
  }
  return scheduled;
}

// Prochaine occurrence de l'heure réglée : aujourd'hui si elle est encore
// devant nous, demain sinon.
export function nextReminderOccurrence(hour: number, now: Date = new Date()): Date {
  const at = new Date(now);
  at.setHours(hour, 0, 0, 0);
  if (at.getTime() <= now.getTime()) at.setDate(at.getDate() + 1);
  return at;
}

export async function cancelTaskDigest(): Promise<void> {
  await cancelByKind('tasks');
}

// Rappel quotidien de la checklist d'équipe. Volontairement one-shot,
// reprogrammé à chaque changement d'état plutôt que déclencheur répétitif :
// c'est ce qui permet au message de porter le vrai nombre de tâches restantes
// et de rester muet quand il n'y a rien à faire (ou que le jour est fermé —
// pendingCount vaut alors 0). Contrepartie assumée : si l'app n'est jamais
// ouverte, le rappel n'est pas rafraîchi.
export async function scheduleTaskDigest(
  hour: number | undefined,
  pendingCount: number
): Promise<string | null> {
  if (!Notifications) return null;
  await cancelTaskDigest();
  if (hour === undefined || pendingCount <= 0) return null;
  const granted = await ensureNotificationPermissions();
  if (!granted) return null;
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '📋 Tâches du jour',
      body: pendingCount > 1
        ? `${pendingCount} tâches sont encore à faire.`
        : 'Une tâche est encore à faire.',
      data: { kind: 'tasks' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nextReminderOccurrence(hour),
      channelId: 'task-reminders',
    },
  });
  return id;
}
