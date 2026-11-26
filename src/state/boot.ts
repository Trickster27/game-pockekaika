import { createPlatform } from '@/platform';
import { LocalSaveBackend, SaveManager, type SaveData } from '@/save';
import { tr, useI18n } from '@/i18n';
import {
  trackQuest,
  ENERGY_MAX,
  energyRegenMs,
  IDLE_MIN_SHOW_MS,
  idleFullAt,
  pendingIdle,
  regenEnergy,
} from '@/game';
import { services } from './services';
import { useGame } from './store';

/** Применяет настройки игрока к адаптерам платформы. */
export function applySettings(save: SaveData) {
  const p = services.platform;
  if (!p) return;
  p.audio.setMuted(!save.settings.sound);
  p.audio.setVolume(save.settings.volume);
  p.haptics.setEnabled(save.settings.haptics);
  useI18n.getState().setLocale(save.settings.locale);
}

/** Запуск игры: платформа → сейв → настройки → подписки на жизненный цикл. */
export async function boot(): Promise<void> {
  const platform = await createPlatform();
  services.platform = platform;
  const manager = new SaveManager(new LocalSaveBackend(platform.storage));
  services.saves = manager;
  const { save, source } = await manager.load();
  applySettings(save);

  manager.subscribe((s) => {
    applySettings(s);
    useGame.setState({ save: s });
  });

  const NOTIFY_IDLE = 1;
  const NOTIFY_ENERGY = 2;
  const scheduleReminders = async () => {
    const s = manager.data;
    if (!s.settings.notifications || !platform.notifications.supported) return;
    if (!(await platform.notifications.requestPermission())) return;
    const now = Date.now();
    const full = idleFullAt(s);
    if (full > now + 60_000)
      await platform.notifications.schedule({
        id: NOTIFY_IDLE,
        title: tr('notify.idleTitle'),
        body: tr('notify.idleBody'),
        at: full,
      });
    const c = { ...s.currencies };
    const regen = energyRegenMs(s);
    regenEnergy(c, now, regen);
    if (c.energy < ENERGY_MAX) {
      const at = c.energyUpdatedAt + (ENERGY_MAX - c.energy) * regen;
      await platform.notifications.schedule({
        id: NOTIFY_ENERGY,
        title: tr('notify.energyTitle'),
        body: tr('notify.energyBody'),
        at,
      });
    }
  };

  // При уходе в фон запоминаем время выхода, пишем сейв и ставим напоминания.
  platform.lifecycle.onPause(() => {
    manager.update((s) => {
      s.lastSeenAt = Date.now();
    });
    void manager.flushNow();
    void scheduleReminders().catch(() => undefined);
  });

  // При возврате: снимаем напоминания и показываем экран добычи, если набежало.
  const checkIdle = () => {
    if (
      pendingIdle(manager.data, Date.now()).ms >= IDLE_MIN_SHOW_MS &&
      useGame.getState().screen !== 'battle'
    )
      useGame.getState().setIdleOpen(true);
  };
  platform.lifecycle.onResume(() => {
    void platform.notifications.cancel(NOTIFY_IDLE).catch(() => undefined);
    void platform.notifications.cancel(NOTIFY_ENERGY).catch(() => undefined);
    checkIdle();
  });

  // Кнопка «Назад» на Android: закрыть окно → вернуться в лагерь → выйти из игры.
  platform.lifecycle.onBackButton(() => {
    const g = useGame.getState();
    if (g.idleOpen) return g.setIdleOpen(false);
    if (g.screen === 'battle') return; // из боя выходят через ✕, чтобы случайно не потерять бой
    if (g.screen === 'camp') return platform.lifecycle.exit();
    g.go('camp');
  });

  // Браузер разрешает звук только после первого жеста пользователя.
  const unlock = () => {
    platform.audio.unlock();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  manager.update((s) => trackQuest(s, 'login'));
  useGame.setState({ ready: true, save: manager.data, loadSource: source });
  checkIdle();
  // Онлайн подключаем после загрузки сейва; без сети игра работает как раньше.
  void import('./online').then((m) => m.initOnline()).catch((e) => console.warn('[online]', e));
}
