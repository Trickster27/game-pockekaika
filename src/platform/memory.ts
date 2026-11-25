import type { StorageAdapter } from './types';

/** Хранилище в памяти: для тестов и как последний запасной вариант. */
export class MemoryStorage implements StorageAdapter {
  readonly kind = 'memory';
  readonly data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async set(key: string, value: string) {
    this.data.set(key, value);
  }
  async remove(key: string) {
    this.data.delete(key);
  }
}
