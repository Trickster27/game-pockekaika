import { createPlatform } from '@/platform';
import { LocalSaveBackend, SaveManager, type SaveData } from '@/save';
import { tr, useI18n } from '@/i18n';
import { ENERGY_MAX, ENERGY_REGEN_MS, IDLE_MIN_SHOW_MS, idleFullAt, pendingIdle, regenEnergy } from '@/game';
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
    regenEnergy(c, now);
    if (c.energy < ENERGY_MAX) {
      const at = c.energyUpdatedAt + (ENERGY_MAX - c.energy) * ENERGY_REGEN_MS;
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

  // Браузер разрешает звук только после первого жеста пользователя.
  const unlock = () => {
    platform.audio.unlock();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  useGame.setState({ ready: true, save: manager.data, loadSource: source });
  checkIdle();
}
