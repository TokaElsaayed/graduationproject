import { Palette } from '@/constants/theme';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { ReminderDose } from './reminders-api';

const CHANNEL_ID = 'medicine-reminders';

export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    if (window.Notification.permission === 'granted') return true;
    return (await window.Notification.requestPermission()) === 'granted';
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Medicine reminders',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: Palette.primary,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export async function syncUpcomingNotifications(doses: ReminderDose[]): Promise<void> {
  if (Platform.OS === 'web') return;
  const upcoming = doses.filter((dose) => dose.displayStatus === 'upcoming');
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingKeys = new Set(existing.map((item) => item.content.data?.doseKey).filter((key): key is string => typeof key === 'string'));
  const wantedKeys = new Set(upcoming.map((dose) => dose.id));

  for (const item of existing) {
    const key = item.content.data?.doseKey;
    if (typeof key === 'string' && key.startsWith('upcoming:') && !wantedKeys.has(key)) {
      await Notifications.cancelScheduledNotificationAsync(item.identifier);
    }
  }

  for (const dose of upcoming) {
    if (existingKeys.has(dose.id)) continue;
    const date = new Date(dose.scheduledAt);
    if (date.getTime() <= Date.now()) continue;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Medicine reminder',
        body: `Time to take ${dose.medicationName}: ${dose.dose}.`,
        data: { doseKey: dose.id, url: '/reminders' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date,
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
    });
  }
}

export async function showDoseNotification(dose: ReminderDose): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.Notification?.permission === 'granted') {
      new window.Notification('Medicine reminder', { body: `Time to take ${dose.medicationName}: ${dose.dose}.` });
    }
    return;
  }
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Medicine reminder',
      body: `Time to take ${dose.medicationName}: ${dose.dose}.`,
      data: { doseId: dose.id, url: '/reminders' },
    },
    trigger: null,
  });
}
