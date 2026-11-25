import type { NotificationAdapter, ScheduledNotification } from '../types';

/**
 * В браузере уведомления — заглушка: запланированные записи только логируются.
 * Настоящие push в PWA потребуют сервер, это вне первого этапа.
 */
export class WebNotificationStub implements NotificationAdapter {
  readonly supported = false;
  readonly scheduled = new Map<number, ScheduledNotification>();

  async requestPermission(): Promise<boolean> {
    return false;
  }
  async schedule(n: ScheduledNotification): Promise<void> {
    this.scheduled.set(n.id, n);
    if (import.meta.env?.DEV) console.info('[notify:web-stub]', new Date(n.at).toLocaleString(), n.title);
  }
  async cancel(id: number): Promise<void> {
    this.scheduled.delete(id);
  }
}
