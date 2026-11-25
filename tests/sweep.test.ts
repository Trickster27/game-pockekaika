import { describe, expect, it } from 'vitest';
import { createNewSave } from '@/save/schema';
import { useGame } from '@/state/store';
import { canSweepStage, sweepCampaignStage } from '@/state/actions';
import { services } from '@/state/services';
import type { SaveManager } from '@/save';

// Простой менеджер сейва: изменения применяются к сейву в сторе.
services.saves = {
  update: (m: (s: ReturnType<typeof createNewSave>) => void) => {
    const s = structuredClone(useGame.getState().save!);
    m(s);
    return s;
  },
} as unknown as SaveManager;

describe('зачистка', () => {
  it('только для 3★, тратит энергию, пишет сводку, останавливается без энергии', () => {
    const s = createNewSave(Date.now());
    s.heroes.forEach((h) => {
      h.level = 30;
      h.stars = 4;
    });
    s.currencies.energy = 13;
    useGame.setState({ save: s, ready: true });
    expect(canSweepStage('1-1')).toBe(false);
    s.campaign.stars['1-1'] = 3;
    expect(canSweepStage('1-1')).toBe(true);
    const goldBefore = s.currencies.gold;
    const r = sweepCampaignStage('1-1', 10)!;
    const after = useGame.getState().save!;
    expect(r.stop).toBe('energy');
    expect(r.done).toBeGreaterThan(0);
    expect(after.currencies.energy).toBeLessThan(13);
    expect(after.currencies.gold).toBeGreaterThan(goldBefore);
    const sum = useGame.getState().summary!;
    expect(sum.lines.length).toBeGreaterThan(0);
    expect(sum.note).toContain(String(r.done));
  });
});
