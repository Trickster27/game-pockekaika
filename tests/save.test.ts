import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '@/platform/memory';
import {
  createNewSave,
  LocalSaveBackend,
  migrate,
  SAVE_VERSION,
  SaveFormatError,
  SaveManager,
  SaveVersionError,
  type Migration,
} from '@/save';

const NOW = 1_700_000_000_000;
const mk = (storage = new MemoryStorage()) => ({
  storage,
  manager: new SaveManager(new LocalSaveBackend(storage), { debounceMs: 10, now: () => NOW }),
});

describe('migrate', () => {
  it('приводит сейв без версии к текущей', () => {
    expect(migrate({ player: { name: 'A' } }).version).toBe(SAVE_VERSION);
  });

  it('применяет шаги по порядку', () => {
    const steps: Record<number, Migration> = {
      1: (s) => ({ ...s, version: 1, a: 1 }),
      2: (s) => ({ ...s, version: 2, b: (s.a as number) + 1 }),
      3: (s) => ({ ...s, version: 3, c: (s.b as number) * 10 }),
    };
    expect(migrate({ version: 1, a: 5 }, 3, steps)).toEqual({ version: 3, a: 5, b: 6, c: 60 });
    expect(migrate({}, 3, steps)).toEqual({ version: 3, a: 1, b: 2, c: 20 });
  });

  it('ругается на сейв из будущего и на пропущенный шаг', () => {
    expect(() => migrate({ version: 99 })).toThrow(SaveVersionError);
    expect(() => migrate({ version: 1 }, 3, { 2: (s) => s })).toThrow(/2 → 3/);
    expect(() => migrate({ version: 'x' })).toThrow(SaveVersionError);
  });
});

describe('SaveManager', () => {
  it('создаёт новый сейв, если ничего нет, и сразу пишет его', async () => {
    const { manager, storage } = mk();
    const { save, source } = await manager.load();
    expect(source).toBe('new');
    expect(save.version).toBe(SAVE_VERSION);
    expect(storage.data.get('save.main')).toBeTruthy();
  });

  it('сохраняет изменения и читает их обратно', async () => {
    const { manager, storage } = mk();
    await manager.load();
    manager.update((s) => {
      s.currencies.gold = 4242;
    });
    await manager.flushNow();
    const again = mk(storage).manager;
    const { save, source } = await again.load();
    expect(source).toBe('main');
    expect(save.currencies.gold).toBe(4242);
  });

  it('при битом основном сейве берёт резервную копию', async () => {
    const { manager, storage } = mk();
    await manager.load();
    manager.update((s) => void (s.currencies.gold = 1));
    await manager.flushNow();
    manager.update((s) => void (s.currencies.gold = 2));
    await manager.flushNow();
    storage.data.set('save.main', '{битый');
    const { save, source } = await mk(storage).manager.load();
    expect(source).toBe('backup');
    expect(save.currencies.gold).toBe(1);
  });

  it('нормализует мусорные значения, а не падает', () => {
    const { manager } = mk();
    const s = manager.parse(
      JSON.stringify({
        version: 1,
        currencies: { gold: -5, shards: 'много' },
        settings: { volume: 9, battleSpeed: 7 },
      }),
    );
    expect(s.currencies.gold).toBe(0);
    expect(s.currencies.shards).toBe(createNewSave(NOW).currencies.shards);
    expect(s.settings.volume).toBe(1);
    expect(s.settings.battleSpeed).toBe(3);
  });

  it('экспорт и импорт дают тот же сейв', async () => {
    const a = mk().manager;
    await a.load();
    a.update((s) => {
      s.player.name = 'Тест';
      s.currencies.shards = 777;
    });
    const json = a.exportJson();
    const b = mk().manager;
    await b.load();
    const imported = await b.importJson(json);
    expect(imported.player.name).toBe('Тест');
    expect(imported.currencies.shards).toBe(777);
    expect(imported.saveId).toBe(a.data.saveId);
  });

  it('отклоняет чужой JSON при импорте', async () => {
    const { manager } = mk();
    await manager.load();
    await expect(manager.importJson('[1,2,3]')).rejects.toThrow(SaveFormatError);
    await expect(manager.importJson('{"hello":"world"}')).rejects.toThrow(SaveFormatError);
    await expect(manager.importJson('не json')).rejects.toThrow(SaveFormatError);
  });

  it('собирает частые изменения в одну запись', async () => {
    const storage = new MemoryStorage();
    let writes = 0;
    const orig = storage.set.bind(storage);
    storage.set = async (k, v) => {
      if (k === 'save.main') writes++;
      return orig(k, v);
    };
    const m = new SaveManager(new LocalSaveBackend(storage), { debounceMs: 20, now: () => NOW });
    await m.load();
    writes = 0;
    for (let i = 0; i < 10; i++) m.update((s) => void (s.currencies.gold += 1));
    await new Promise((r) => setTimeout(r, 60));
    expect(writes).toBe(1);
    expect(m.data.currencies.gold).toBe(createNewSave(NOW).currencies.gold + 10);
  });
});
