import { beginRaid, finishRaid, raidSetup, raidWeek } from '@/game';
import type { BattleResult } from '@/core/battle';
import { formatNumber, tr } from '@/i18n';
import { useGame, type RewardLine } from './store';
import { rewardLines } from './clan';

/** Запустить попытку рейда: попытка списывается сразу, урон засчитывается и при выходе из боя. */
export function startRaid(): boolean {
  const g = useGame.getState();
  let r: ReturnType<typeof beginRaid> = 'noTeam';
  g.updateSave((s) => {
    r = beginRaid(s, Date.now());
  });
  const res = r as ReturnType<typeof beginRaid>;
  if (typeof res === 'string') {
    g.showToast(tr(res === 'noTeam' ? 'campaign.noTeam' : 'raid.noAttempts'));
    return false;
  }
  const now = Date.now();
  const w = raidWeek(now);
  g.startBattle({
    title: tr('raid.title'),
    subtitle: `${tr(`labels.element.${w.element}`)} · ${w.mutation.name}`,
    scene: 'sky',
    setup: raidSetup(g.save!, now, res.seed),
    returnTo: 'raid',
    mode: 'boss',
    resultTitle: (b: BattleResult) => (b.surrendered ? tr('raid.left') : tr('raid.over')),
    finish: (b: BattleResult) => {
      const damage = b.damage ?? 0;
      let out: ReturnType<typeof finishRaid> | null = null;
      useGame.getState().updateSave((s) => {
        out = finishRaid(s, damage, Date.now());
      });
      const o = out as ReturnType<typeof finishRaid> | null;
      const lines: RewardLine[] = [{ icon: 'star', label: tr('raid.damage'), value: formatNumber(damage) }];
      if (o?.newBest) lines.push({ icon: 'level', label: tr('raid.newBest'), value: '' });
      if (o) lines.push(...rewardLines(o.reward));
      return lines;
    },
  });
  return true;
}
