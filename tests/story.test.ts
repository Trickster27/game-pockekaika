import { describe, expect, it } from 'vitest';
import { STORY, enemyDef, heroDef, stageById, storyFor } from '@/content';

const CYR = /[А-Яа-яЁё]/;

describe('сюжет', () => {
  it('у каждой главы есть вступление, встреча с боссом и развязка', () => {
    for (let c = 1; c <= 6; c++)
      for (const tr of ['intro', 'boss', 'outro'] as const)
        expect(
          STORY.some((s) => s.chapter === c && s.trigger === tr),
          `${c} ${tr}`,
        ).toBe(true);
  });

  it('сцены глав 1–5 привязаны к существующим этапам, вступление — к первому, босс — к десятому', () => {
    for (const s of STORY.filter((x) => x.chapter <= 5)) {
      expect(stageById(s.stage), s.id).toBeTruthy();
      expect(s.stage.endsWith(s.trigger === 'intro' ? '-1' : '-10'), s.id).toBe(true);
    }
    expect(storyFor('1-1', 'intro')?.id).toBe('c1-intro');
    expect(storyFor('3-10', 'outro')?.id).toBe('c3-outro');
  });

  it('реплики на двух языках, английский без кириллицы, говорящие существуют', () => {
    const ids = new Set(STORY.map((s) => s.id));
    expect(ids.size).toBe(STORY.length);
    for (const s of STORY) {
      expect(s.lines.length).toBeGreaterThan(2);
      expect(CYR.test(s.title.en), s.id).toBe(false);
      for (const l of s.lines) {
        expect(l.ru.length).toBeGreaterThan(5);
        expect(CYR.test(l.en), `${s.id}: ${l.en}`).toBe(false);
        if (['narrator', 'warden', 'void_herald'].includes(l.who)) continue;
        const ok = (() => {
          try {
            heroDef(l.who);
            return true;
          } catch {
            return !!enemyDef(l.who);
          }
        })();
        expect(ok, l.who).toBe(true);
      }
    }
  });
});
