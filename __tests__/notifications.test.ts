import * as Notifications from 'expo-notifications';
import {
  ensureNotificationPermissions,
  scheduleDlcReminder,
  rescheduleAllDlcReminders,
  scheduleTaskDigest,
  nextReminderOccurrence,
} from '../src/lib/notifications';
import { Product } from '../src/types';

const mkProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  bacId: '1',
  name: 'Test',
  quantity: 1,
  unit: 'kg',
  actionType: 'received',
  addedAt: Date.now(),
  modifiedAt: Date.now(),
  dlc: Date.now() + 2 * 86400000,
  status: 'active',
  syncStatus: 'pending',
  ...overrides,
});

describe('Notifications', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests permission when not already granted', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'undetermined' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'granted' });
    const ok = await ensureNotificationPermissions();
    expect(ok).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('returns false when permission denied', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const ok = await ensureNotificationPermissions();
    expect(ok).toBe(false);
  });

  it('schedules reminder 1 day before DLC', async () => {
    const product = mkProduct({ dlc: Date.now() + 5 * 86400000 });
    const id = await scheduleDlcReminder(product);
    expect(id).toBe('notif-id-1');
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toContain(product.name);
    expect(call.trigger.channelId).toBe('dlc-alerts');
  });

  it('skips reminders already in the past', async () => {
    const product = mkProduct({ dlc: Date.now() - 86400000 });
    const id = await scheduleDlcReminder(product);
    expect(id).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('reschedules cancels old + only schedules active future products', async () => {
    const count = await rescheduleAllDlcReminders([
      mkProduct({ id: 'a', dlc: Date.now() + 5 * 86400000 }),
      mkProduct({ id: 'b', status: 'used' }),
      mkProduct({ id: 'c', dlc: Date.now() - 86400000 }),
      mkProduct({ id: 'd', dlc: Date.now() + 10 * 86400000 }),
    ]);
    expect(count).toBe(2);
  });

  // Le rappel de tâches et les rappels DLC coexistent : un cancelAll() global
  // effacerait le premier à chaque modification de produit.
  it('reschedule only cancels DLC reminders, never the task digest', async () => {
    (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValueOnce([
      { identifier: 'dlc-1', content: { data: { kind: 'dlc' } } },
      { identifier: 'legacy', content: { data: {} } },
      { identifier: 'task-1', content: { data: { kind: 'tasks' } } },
    ]);
    await rescheduleAllDlcReminders([]);
    const cancelled = (Notifications.cancelScheduledNotificationAsync as jest.Mock).mock.calls.map((c) => c[0]);
    // Les rappels sans `kind` viennent d'une version antérieure : c'étaient des DLC.
    expect(cancelled).toEqual(['dlc-1', 'legacy']);
    expect(cancelled).not.toContain('task-1');
    expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
  });
});

describe('Rappel des tâches', () => {
  beforeEach(() => jest.clearAllMocks());

  it('porte le nombre réel de tâches restantes', async () => {
    const id = await scheduleTaskDigest(17, 3);
    expect(id).toBe('notif-id-1');
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.body).toContain('3 tâches');
    expect(call.content.data.kind).toBe('tasks');
    expect(call.trigger.channelId).toBe('task-reminders');
  });

  it('reste muet quand il n\'y a rien à faire ou aucune heure réglée', async () => {
    expect(await scheduleTaskDigest(17, 0)).toBeNull();
    expect(await scheduleTaskDigest(undefined, 5)).toBeNull();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('vise aujourd\'hui si l\'heure est devant, demain sinon', () => {
    const now = new Date(2026, 7, 20, 14, 30);
    expect(nextReminderOccurrence(17, now).getDate()).toBe(20);
    expect(nextReminderOccurrence(9, now).getDate()).toBe(21);
  });
});
