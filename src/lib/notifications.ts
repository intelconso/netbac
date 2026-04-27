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
  }
  return status === 'granted';
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
      data: { productId: product.id },
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
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
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
