import { useEffect, useRef } from 'react';
import { Stack, router, usePathname } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { AuthProvider } from '@/auth/auth-context';
import { useAuth } from '@/auth/auth-context';
import { reminderRequest, type ReminderDose } from '@/reminders/reminders-api';
import { syncUpcomingNotifications } from '@/reminders/reminder-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  return (
    <AuthProvider>
      <NotificationNavigation />
      <DueReminderNavigation />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}

function DueReminderNavigation() {
  const { isReady, token } = useAuth();
  const pathname = usePathname();
  const openedReminder = useRef('');
  const scheduledDoseSignature = useRef('');

  useEffect(() => {
    if (!isReady || !token) return;
    let active = true;
    const poll = async () => {
      try {
        const doses = await reminderRequest<ReminderDose[]>(token, '/reminders/today');
        if (!active) return;
        const upcomingSignature = doses
          .filter((dose) => dose.displayStatus === 'upcoming')
          .map((dose) => `${dose.id}:${dose.scheduledAt}`)
          .sort()
          .join('|');
        if (upcomingSignature !== scheduledDoseSignature.current) {
          scheduledDoseSignature.current = upcomingSignature;
          void syncUpcomingNotifications(doses).catch(() => undefined);
        }
        const due = doses.find((dose) => dose.status === 'pending' && dose.displayStatus === 'due');
        if (!due) return;
        const reminderKey = `${due.id}:${due.reminderCount}`;
        if (reminderKey === openedReminder.current) return;
        openedReminder.current = reminderKey;
        if (pathname !== '/reminders' && pathname !== '/health-check' && pathname !== '/login') router.push('/reminders');
      } catch {
        // The reminder screen surfaces connection errors if the API is unavailable.
      }
    };
    void poll();
    const interval = setInterval(() => void poll(), 4000);
    return () => { active = false; clearInterval(interval); };
  }, [isReady, token, pathname]);

  return null;
}

function NotificationNavigation() {
  useEffect(() => {
    // Notification response APIs are implemented only on native platforms.
    if (Platform.OS === 'web') return;

    const openReminder = (data: Notifications.NotificationContent['data'] | undefined) => {
      if (data?.url === '/reminders') router.push('/reminders');
    };
    openReminder(Notifications.getLastNotificationResponse()?.notification.request.content.data);
    const listener = Notifications.addNotificationResponseReceivedListener((response) => {
      openReminder(response.notification.request.content.data);
    });
    return () => listener.remove();
  }, []);
  return null;
}
