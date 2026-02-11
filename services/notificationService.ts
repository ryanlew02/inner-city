import * as Notifications from 'expo-notifications';
import { Habit, parseScheduleJson } from '../types/habit';
import { Platform } from 'react-native';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return false;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('habit-reminders', {
      name: 'Habit Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  return true;
}

export async function cancelHabitNotifications(habitId: string): Promise<void> {
  const allScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const toCancel = allScheduled.filter(n =>
    n.identifier.startsWith(`${habitId}-`)
  );

  for (const notification of toCancel) {
    await Notifications.cancelScheduledNotificationAsync(notification.identifier);
  }
}

export async function scheduleHabitNotifications(habit: Habit): Promise<void> {
  const scheduleData = parseScheduleJson(habit.schedule_json);

  if (!scheduleData.notification_enabled || !scheduleData.notification_time) {
    return;
  }

  // Cancel existing notifications for this habit first
  await cancelHabitNotifications(habit.id);

  const [hourStr, minuteStr] = scheduleData.notification_time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const message = scheduleData.notification_message?.trim()
    || `Don't forget about your ${habit.name} habit`;

  const content: Notifications.NotificationContentInput = {
    title: habit.name,
    body: message,
    sound: 'default',
    ...(Platform.OS === 'android' && { channelId: 'habit-reminders' }),
  };

  if (scheduleData.specific_days && scheduleData.specific_days.length > 0) {
    // Schedule one weekly trigger per selected day
    for (let i = 0; i < scheduleData.specific_days.length; i++) {
      const weekday = scheduleData.specific_days[i];
      // expo-notifications uses 1=Sunday, 2=Monday, ..., 7=Saturday
      // our data uses 0=Sunday, 1=Monday, ..., 6=Saturday
      const expoWeekday = weekday + 1;

      await Notifications.scheduleNotificationAsync({
        identifier: `${habit.id}-${i}`,
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: expoWeekday,
          hour,
          minute,
        },
      });
    }
  } else if (scheduleData.days_of_month && scheduleData.days_of_month.length > 0) {
    // Schedule for specific days of month for the next 60 days
    const now = new Date();
    let notifIndex = 0;

    for (let dayOffset = 0; dayOffset < 60; dayOffset++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + dayOffset);
      const dayOfMonth = targetDate.getDate();

      if (scheduleData.days_of_month.includes(dayOfMonth)) {
        const triggerDate = new Date(
          targetDate.getFullYear(),
          targetDate.getMonth(),
          targetDate.getDate(),
          hour,
          minute,
          0
        );

        // Skip if the trigger time is in the past
        if (triggerDate <= now) continue;

        await Notifications.scheduleNotificationAsync({
          identifier: `${habit.id}-${notifIndex}`,
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: triggerDate,
          },
        });
        notifIndex++;
      }
    }
  } else {
    // Daily trigger (for 'daily' and 'times_per_week' schedule types)
    await Notifications.scheduleNotificationAsync({
      identifier: `${habit.id}-0`,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
      },
    });
  }
}

export async function rescheduleMonthlyNotifications(habits: Habit[]): Promise<void> {
  for (const habit of habits) {
    const scheduleData = parseScheduleJson(habit.schedule_json);
    if (
      scheduleData.notification_enabled &&
      scheduleData.days_of_month &&
      scheduleData.days_of_month.length > 0
    ) {
      await scheduleHabitNotifications(habit);
    }
  }
}
