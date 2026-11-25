import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import type { HapticsAdapter, ImpactStrength, NotifyKind } from '../types';

const IMPACT: Record<ImpactStrength, ImpactStyle> = {
  light: ImpactStyle.Light,
  medium: ImpactStyle.Medium,
  heavy: ImpactStyle.Heavy,
};
const NOTIFY: Record<NotifyKind, NotificationType> = {
  success: NotificationType.Success,
  warning: NotificationType.Warning,
  error: NotificationType.Error,
};

export class CapacitorHaptics implements HapticsAdapter {
  private enabled = true;
  impact(strength: ImpactStrength = 'light') {
    if (this.enabled) void Haptics.impact({ style: IMPACT[strength] }).catch(() => undefined);
  }
  notify(kind: NotifyKind) {
    if (this.enabled) void Haptics.notification({ type: NOTIFY[kind] }).catch(() => undefined);
  }
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }
}
