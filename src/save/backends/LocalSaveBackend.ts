import type { StorageAdapter } from '@/platform/types';
import type { SaveBackend } from './SaveBackend';

const MAIN = 'save.main';
const BACKUP = 'save.backup';

/** Локальный сейв через адаптер хранилища платформы. Перед каждой записью старая копия уходит в backup. */
export class LocalSaveBackend implements SaveBackend {
  readonly id = 'local';
  constructor(private readonly storage: StorageAdapter) {}

  read() {
    return this.storage.get(MAIN);
  }
  readBackup() {
    return this.storage.get(BACKUP);
  }
  async write(json: string) {
    const prev = await this.storage.get(MAIN);
    if (prev && prev !== json) await this.storage.set(BACKUP, prev);
    await this.storage.set(MAIN, json);
  }
  async clear() {
    await this.storage.remove(MAIN);
    await this.storage.remove(BACKUP);
  }
}
