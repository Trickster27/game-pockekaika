import { Capacitor } from '@capacitor/core';
import type { Platform, PlatformName } from './types';
import { IndexedDbStorageAdapter } from './web/storage';
import { WebNotificationStub } from './web/notifications';
import { WebHaptics } from './web/haptics';
import { WebLifecycle } from './web/lifecycle';
import { WebAudioAdapter } from './shared/audio';

export type * from './types';

/**
 * Собирает адаптеры под текущую платформу.
 * Нативные модули грузятся динамически, поэтому не попадают в первый чанк веб-сборки.
 */
export async function createPlatform(): Promise<Platform> {
  const audio = new WebAudioAdapter();
  if (Capacitor.isNativePlatform()) {
    const [
      { CapacitorPreferencesStorage },
      { CapacitorNotifications },
      { CapacitorHaptics },
      { CapacitorLifecycle },
    ] = await Promise.all([
      import('./capacitor/storage'),
      import('./capacitor/notifications'),
      import('./capacitor/haptics'),
      import('./capacitor/lifecycle'),
    ]);
    return {
      name: Capacitor.getPlatform() as PlatformName,
      isNative: true,
      storage: new CapacitorPreferencesStorage(),
      notifications: new CapacitorNotifications(),
      haptics: new CapacitorHaptics(),
      audio,
      lifecycle: new CapacitorLifecycle(),
    };
  }
  return {
    name: 'web',
    isNative: false,
    storage: new IndexedDbStorageAdapter(),
    notifications: new WebNotificationStub(),
    haptics: new WebHaptics(),
    audio,
    lifecycle: new WebLifecycle(),
  };
}
