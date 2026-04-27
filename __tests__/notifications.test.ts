import * as Notifications from 'expo-notifications';
import {
  ensureNotificationPermissions,
  scheduleDlcReminder,
  rescheduleAllDlcReminders,
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
    expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalledTimes(1);
    expect(count).toBe(2);
  });
});
