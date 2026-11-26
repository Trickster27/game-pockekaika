import { Capacitor } from '@capacitor/core';

/**
 * Регистрирует сервис-воркер PWA только в браузере: игра работает офлайн и ставится на главный экран.
 * Установленная на телефон игра может неделями не перезапускаться, поэтому новую версию проверяем
 * каждые 30 минут и при каждом возврате в игру; найденное обновление ставится и страница перезагружается.
 */
export function registerPwa() {
  if (Capacitor.isNativePlatform() || import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) =>
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (!reg) return;
        const check = () => void reg.update().catch(() => undefined);
        setInterval(check, 30 * 60_000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
    }),
  );
}
