import type { StorageAdapter } from '../types';

const PREFIX = 'kaelmor:';

/** Хранилище на localStorage. Если оно недоступно (приватный режим), данные живут в памяти. */
export class LocalStorageAdapter implements StorageAdapter {
  readonly kind = 'localStorage';
  private memory = new Map<string, string>();

  private get ls(): Storage | null {
    try {
      return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      const v = this.ls?.getItem(PREFIX + key);
      if (v != null) return v;
    } catch {
      /* пробуем память */
    }
    return this.memory.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.memory.set(key, value);
    try {
      this.ls?.setItem(PREFIX + key, value);
    } catch {
      /* квота или запрет — остаёмся в памяти */
    }
  }

  async remove(key: string): Promise<void> {
    this.memory.delete(key);
    try {
      this.ls?.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Хранилище на IndexedDB: не упирается в лимит ~5 МБ у localStorage.
 * Если IndexedDB не открылась, все вызовы уходят в запасной адаптер.
 */
export class IndexedDbStorageAdapter implements StorageAdapter {
  readonly kind = 'indexedDB';
  private dbPromise: Promise<IDBDatabase | null>;

  constructor(
    private readonly fallback: StorageAdapter = new LocalStorageAdapter(),
    dbName = 'kaelmor',
  ) {
    this.dbPromise = new Promise((resolve) => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = () => req.result.createObjectStore('kv');
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  private async tx<T>(
    mode: IDBTransactionMode,
    run: (s: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T | undefined> {
    const db = await this.dbPromise;
    if (!db) return undefined;
    return new Promise<T | undefined>((resolve, reject) => {
      const req = run(db.transaction('kv', mode).objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async get(key: string): Promise<string | null> {
    if (!(await this.dbPromise)) return this.fallback.get(key);
    try {
      const v = await this.tx<unknown>('readonly', (s) => s.get(key));
      return typeof v === 'string' ? v : null;
    } catch {
      return this.fallback.get(key);
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (!(await this.dbPromise)) return this.fallback.set(key, value);
    try {
      await this.tx('readwrite', (s) => s.put(value, key));
    } catch {
      await this.fallback.set(key, value);
    }
  }

  async remove(key: string): Promise<void> {
    if (!(await this.dbPromise)) return this.fallback.remove(key);
    try {
      await this.tx('readwrite', (s) => s.delete(key));
    } catch {
      await this.fallback.remove(key);
    }
  }
}
