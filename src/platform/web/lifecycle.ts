import type { LifecycleAdapter, Unsubscribe } from '../types';

/** Пауза = вкладка скрыта или страница выгружается; возврат = вкладка снова видима. */
export class WebLifecycle implements LifecycleAdapter {
  onPause(cb: () => void): Unsubscribe {
    const onVis = () => {
      if (document.visibilityState === 'hidden') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', cb);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', cb);
    };
  }
  onResume(cb: () => void): Unsubscribe {
    const onVis = () => {
      if (document.visibilityState === 'visible') cb();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }
  onBackButton(_cb: () => void): Unsubscribe {
    return () => undefined;
  }
  exit() {
    /* в браузере закрывать нечего */
  }
}
