import { createNewSave, type SaveData } from './schema';
import { migrate, type RawSave } from './migrations';
import { normalizeSave, SaveFormatError } from './validate';
import type { SaveBackend } from './backends/SaveBackend';

export interface SaveManagerOptions {
  /** Задержка перед записью после изменения: частые правки собираются в одну запись. */
  debounceMs?: number;
  now?: () => number;
}

export type LoadSource = 'main' | 'backup' | 'new';

/** Формат файла экспорта: обёртка с типом, чтобы не перепутать с чужим JSON. */
interface ExportEnvelope {
  kind: 'kaelmor-save';
  exportedAt: number;
  save: SaveData;
}

export class SaveManager {
  private current: SaveData | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing: Promise<void> = Promise.resolve();
  private readonly debounceMs: number;
  private readonly now: () => number;
  private listeners = new Set<(s: SaveData) => void>();

  constructor(
    private readonly backend: SaveBackend,
    opts: SaveManagerOptions = {},
  ) {
    this.debounceMs = opts.debounceMs ?? 800;
    this.now = opts.now ?? Date.now;
  }

  get data(): SaveData {
    if (!this.current) throw new Error('SaveManager: вызовите load() перед использованием');
    return this.current;
  }

  /** Разбирает строку сейва: JSON → миграции → нормализация. */
  parse(json: string): SaveData {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      throw new SaveFormatError('Это не JSON');
    }
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
      throw new SaveFormatError('Сейв должен быть объектом');
    return normalizeSave(migrate(raw as RawSave), this.now());
  }

  /** Загружает сейв: основной, если он битый — резервный, иначе создаёт новый. */
  async load(): Promise<{ save: SaveData; source: LoadSource }> {
    const tryParse = (json: string | null) => {
      if (!json) return null;
      try {
        return this.parse(json);
      } catch (e) {
        console.warn('[save] не удалось прочитать сейв:', e);
        return null;
      }
    };
    let source: LoadSource = 'main';
    let save = tryParse(await this.backend.read());
    if (!save) {
      save = tryParse(await this.backend.readBackup());
      source = save ? 'backup' : 'new';
    }
    if (!save) save = createNewSave(this.now());
    this.current = save;
    if (source !== 'main') await this.flushNow();
    return { save, source };
  }

  /** Меняет сейв через функцию и планирует запись. */
  update(mutator: (draft: SaveData) => void): SaveData {
    const next = structuredClone(this.data);
    mutator(next);
    next.updatedAt = this.now();
    this.current = next;
    this.emit();
    this.schedule();
    return next;
  }

  subscribe(fn: (s: SaveData) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    if (this.current) for (const l of this.listeners) l(this.current);
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flushNow(), this.debounceMs);
  }

  /** Немедленно пишет сейв (например, при сворачивании приложения). */
  async flushNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.current) return;
    const json = JSON.stringify(this.current);
    this.writing = this.writing
      .then(() => this.backend.write(json))
      .catch((e) => console.error('[save] запись не удалась', e));
    await this.writing;
  }

  exportJson(): string {
    const env: ExportEnvelope = { kind: 'kaelmor-save', exportedAt: this.now(), save: this.data };
    return JSON.stringify(env, null, 2);
  }

  /** Импорт из строки экспорта. Принимает и обёртку, и «голый» сейв. */
  async importJson(json: string): Promise<SaveData> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      throw new SaveFormatError('Файл не похож на сейв: это не JSON');
    }
    const inner =
      typeof parsed === 'object' && parsed !== null && (parsed as { kind?: unknown }).kind === 'kaelmor-save'
        ? (parsed as { save: unknown }).save
        : parsed;
    if (typeof inner !== 'object' || inner === null || Array.isArray(inner)) {
      throw new SaveFormatError('Файл не похож на сейв Каэлмора');
    }
    if (!('currencies' in inner) && !('player' in inner))
      throw new SaveFormatError('Файл не похож на сейв Каэлмора');
    const save = normalizeSave(migrate(inner as RawSave), this.now());
    this.current = save;
    this.emit();
    await this.flushNow();
    return save;
  }

  /** Полный сброс прогресса. */
  async reset(): Promise<SaveData> {
    await this.backend.clear();
    this.current = createNewSave(this.now());
    this.emit();
    await this.flushNow();
    return this.current;
  }
}
