import { createPlatform } from '@/platform';
import { LocalSaveBackend, SaveManager, type SaveData } from '@/save';
import { useI18n } from '@/i18n';
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

  // При уходе в фон запоминаем время выхода (от него считаются idle-награды) и сразу пишем сейв.
  platform.lifecycle.onPause(() => {
    manager.update((s) => {
      s.lastSeenAt = Date.now();
    });
    void manager.flushNow();
  });

  // Браузер разрешает звук только после первого жеста пользователя.
  const unlock = () => {
    platform.audio.unlock();
    window.removeEventListener('pointerdown', unlock);
  };
  window.addEventListener('pointerdown', unlock);

  useGame.setState({ ready: true, save: manager.data, loadSource: source });
}
