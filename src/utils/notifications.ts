// Local notifications: a daily closing-time reminder and low-stock alerts.
// Everything stays on the device (no push, no server) — same offline-first
// rule as the rest of the app. Failures are swallowed on purpose: a missed
// notification is never worth interrupting a sale.
//
// IMPORTANT: expo-notifications must NOT be imported statically. Its JS
// eagerly binds push-only native modules (ExpoTopicSubscriptionModule) that
// Expo Go on Android does not ship — remote push was removed from Expo Go in
// SDK 53 — so a static import crashes the whole app at launch there. The
// lazy require below keeps Expo Go bootable; notifications simply no-op
// until the app runs as a real build, where the native modules exist.
import { Platform } from 'react-native';
import type { Product } from '../db/database';

type NotificationsModule = typeof import('expo-notifications');

let cachedModule: NotificationsModule | null | undefined;

function getNotifications(): NotificationsModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedModule = require('expo-notifications') as NotificationsModule;
  } catch (e) {
    // Running somewhere without the native modules (Expo Go on Android).
    cachedModule = null;
  }
  return cachedModule;
}

export const DAILY_REMINDER_HOUR = 20; // 8:00 pm — closing time for most shops
const DAILY_REMINDER_ID = 'daily-summary';

const REMINDER_CHANNEL = 'reminders';
const STOCK_CHANNEL = 'stock';

// Lets the owner see an alert even while Shoka is open in the foreground.
// Without a handler, expo-notifications shows nothing at all.
export function installNotificationHandler(): void {
  const Notifications = getNotifications();
  if (!Notifications) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// Channels group the two kinds of alerts in Android's notification settings.
// They must exist BEFORE requesting permission: Android 13+ won't show the
// permission prompt until the app has at least one channel.
async function ensureChannels(Notifications: NotificationsModule): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL, {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync(STOCK_CHANNEL, {
    name: 'Low-stock alerts',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

// True when notifications may be shown. Never throws; false in Expo Go.
export async function requestNotificationPermission(): Promise<boolean> {
  const Notifications = getNotifications();
  if (!Notifications) return false;
  try {
    await ensureChannels(Notifications);
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync();
    return next.granted;
  } catch (e) {
    return false;
  }
}

// One repeating reminder at closing time. Re-scheduling with the same
// identifier replaces the previous one, so this is safe to call again when
// the shop name changes.
export async function scheduleDailyReminder(shopName: string | null): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: `How did ${shopName || 'the shop'} do today?`,
      body: "Open Reports to see today's money — and share your WhatsApp summary before you close.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: DAILY_REMINDER_HOUR,
      minute: 0,
      channelId: REMINDER_CHANNEL,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch (e) {
    // Nothing scheduled — nothing to cancel.
  }
}

// Fired right after a sale leaves products at or below their threshold. The
// seller already sees the stock strips in the moment; this lands in the tray
// so the restock isn't forgotten after the shop closes.
export async function notifyLowStock(products: Product[]): Promise<void> {
  const Notifications = getNotifications();
  if (!Notifications) return;
  if (products.length === 0) return;
  const names = products.map((p) => `${p.name} (${p.stock_qty} left)`);
  const shown = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` and ${names.length - 3} more` : '';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: products.length === 1 ? 'Running low' : `${products.length} items running low`,
      body: `${shown}${more} — add it to the restock run.`,
    },
    // No date = deliver now; the channel object routes it on Android.
    trigger: Platform.OS === 'android' ? { channelId: STOCK_CHANNEL } : null,
  });
}
