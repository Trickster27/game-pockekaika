import { Preferences } from '@capacitor/preferences';
import type { StorageAdapter } from '../types';

/** Нативное хранилище: SharedPreferences на Android, UserDefaults на iOS. Переживает очистку WebView. */
export class CapacitorPreferencesStorage implements StorageAdapter {
  readonly kind = 'capacitor-preferences';
  async get(key: string) {
    return (await Preferences.get({ key })).value;
  }
  async set(key: string, value: string) {
    await Preferences.set({ key, value });
  }
  async remove(key: string) {
    await Preferences.remove({ key });
  }
}
