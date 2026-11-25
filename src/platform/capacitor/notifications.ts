import { LocalNotifications } from '@capacitor/local-notifications';
import type { NotificationAdapter, ScheduledNotification } from '../types';

export class CapacitorNotifications implements NotificationAdapter {
  readonly supported = true;

  async requestPermission(): Promise<boolean> {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') return true;
    const res = await LocalNotifications.requestPermissions();
    return res.display === 'granted';
  }

  async schedule(n: ScheduledNotification): Promise<void> {
    await this.cancel(n.id);
    await LocalNotifications.schedule({
      notifications: [
        { id: n.id, title: n.title, body: n.body, schedule: { at: new Date(n.at), allowWhileIdle: true } },
      ],
    });
  }

  async cancel(id: number): Promise<void> {
    await LocalNotifications.cancel({ notifications: [{ id }] });
  }
}
