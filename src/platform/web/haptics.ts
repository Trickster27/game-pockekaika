import type { HapticsAdapter, ImpactStrength, NotifyKind } from '../types';

const IMPACT_MS: Record<ImpactStrength, number> = { light: 10, medium: 20, heavy: 35 };
const NOTIFY_PATTERN: Record<NotifyKind, number[]> = {
  success: [15, 60, 25],
  warning: [30, 80, 30],
  error: [40, 60, 40, 60, 40],
};

/** Вибрация через navigator.vibrate (Android Chrome). На iOS Safari её нет — вызовы просто ничего не делают. */
export class WebHaptics implements HapticsAdapter {
  private enabled = true;
  private vibrate(p: number | number[]) {
    if (!this.enabled) return;
    try {
      navigator.vibrate?.(p);
    } catch {
      /* ignore */
    }
  }
  impact(strength: ImpactStrength = 'light') {
    this.vibrate(IMPACT_MS[strength]);
  }
  notify(kind: NotifyKind) {
    this.vibrate(NOTIFY_PATTERN[kind]);
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}
