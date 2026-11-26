/**
 * Интерфейсы платформы. Игровая логика и UI знают только про них,
 * а не про браузер или Capacitor. Реализации — в ./web и ./capacitor.
 */

/** Простое key-value хранилище строк. */
export interface StorageAdapter {
  readonly kind: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface ScheduledNotification {
  /** Целое число: Capacitor требует числовые id. */
  id: number;
  title: string;
  body: string;
  /** Когда показать (unix ms). */
  at: number;
}

/** Локальные уведомления («награды накопились»). */
export interface NotificationAdapter {
  readonly supported: boolean;
  requestPermission(): Promise<boolean>;
  schedule(n: ScheduledNotification): Promise<void>;
  cancel(id: number): Promise<void>;
}

export type ImpactStrength = 'light' | 'medium' | 'heavy';
export type NotifyKind = 'success' | 'warning' | 'error';

/** Вибрация и тактильный отклик. Вызовы безопасны, даже если устройство не поддерживает их. */
export interface HapticsAdapter {
  impact(strength?: ImpactStrength): void;
  notify(kind: NotifyKind): void;
  setEnabled(enabled: boolean): void;
}

/** Звук. Одна реализация на Web Audio подходит и браузеру, и WebView. */
export interface AudioAdapter {
  play(id: SoundId): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
  /** Браузеры разрешают звук только после жеста пользователя. */
  unlock(): void;
  /** Фоновая музыка: тема или тишина (null). */
  music(id: MusicId | null): void;
  setMusicVolume(volume: number): void;
  setMusicEnabled(on: boolean): void;
  /** Приложение ушло в фон / вернулось: музыка замолкает и продолжает. */
  suspend(): void;
  resume(): void;
}

export type MusicId = 'camp' | 'battle' | 'boss';

export type SoundId = 'tap' | 'hit' | 'crit' | 'heal' | 'victory' | 'reward';

export type Unsubscribe = () => void;

/** Жизненный цикл приложения: нужен для idle-наград и сохранения при сворачивании. */
export interface LifecycleAdapter {
  onPause(cb: () => void): Unsubscribe;
  onResume(cb: () => void): Unsubscribe;
  /** Системная кнопка «Назад» (Android). В браузере не срабатывает. */
  onBackButton(cb: () => void): Unsubscribe;
  /** Закрыть приложение (только на телефоне). */
  exit(): void;
}

export type PlatformName = 'web' | 'android' | 'ios';

export interface Platform {
  name: PlatformName;
  isNative: boolean;
  storage: StorageAdapter;
  notifications: NotificationAdapter;
  haptics: HapticsAdapter;
  audio: AudioAdapter;
  lifecycle: LifecycleAdapter;
}
