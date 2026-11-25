import { App } from '@capacitor/app';
import type { LifecycleAdapter, Unsubscribe } from '../types';

/** appStateChange приходит, когда приложение уходит в фон или возвращается. */
export class CapacitorLifecycle implements LifecycleAdapter {
  private listen(active: boolean, cb: () => void): Unsubscribe {
    const handle = App.addListener('appStateChange', (s) => {
      if (s.isActive === active) cb();
    });
    return () => void handle.then((h) => h.remove());
  }
  onPause(cb: () => void) {
    return this.listen(false, cb);
  }
  onResume(cb: () => void) {
    return this.listen(true, cb);
  }
  onBackButton(cb: () => void): Unsubscribe {
    const handle = App.addListener('backButton', () => cb());
    return () => void handle.then((h) => h.remove());
  }
  exit() {
    void App.exitApp();
  }
}
