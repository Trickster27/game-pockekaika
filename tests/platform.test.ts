import { describe, expect, it } from 'vitest';
import { LocalStorageAdapter, IndexedDbStorageAdapter } from '@/platform/web/storage';
import { WebNotificationStub } from '@/platform/web/notifications';

describe('web storage adapters', () => {
  it('localStorage-адаптер работает и без localStorage (в памяти)', async () => {
    const s = new LocalStorageAdapter();
    await s.set('a', '1');
    expect(await s.get('a')).toBe('1');
    await s.remove('a');
    expect(await s.get('a')).toBeNull();
  });

  it('IndexedDB-адаптер без IndexedDB уходит в запасное хранилище', async () => {
    const s = new IndexedDbStorageAdapter();
    await s.set('k', 'v');
    expect(await s.get('k')).toBe('v');
  });
});

describe('web notification stub', () => {
  it('запоминает и отменяет уведомления', async () => {
    const n = new WebNotificationStub();
    await n.schedule({ id: 1, title: 't', body: 'b', at: 0 });
    expect(n.scheduled.size).toBe(1);
    await n.cancel(1);
    expect(n.scheduled.size).toBe(0);
  });
});
