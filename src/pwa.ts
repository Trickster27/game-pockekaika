import { Capacitor } from '@capacitor/core';

/** Регистрирует сервис-воркер PWA только в браузере: игра работает офлайн и ставится на главный экран. */
export function registerPwa() {
  if (Capacitor.isNativePlatform() || import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
