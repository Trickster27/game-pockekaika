import { stageById, nextStage, CHAPTERS } from '@/content';
import { applyStageResult, isStageUnlocked, makeSetup, heroSpec, spendEnergy, teamHeroes } from '@/game';
import { formatNumber, tr } from '@/i18n';
import { useGame, type RewardLine } from './store';

const SCENES = ['mist', 'cathedral', 'forge'] as const;

export function newSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
}

/** Запуск этапа кампании. Возвращает false и показывает подсказку, если начать нельзя. */
export function startCampaignStage(stageId: string): boolean {
  const g = useGame.getState();
  const save = g.save!;
  const stage = stageById(stageId);
  if (!stage || !isStageUnlocked(save, stageId)) return false;
  const team = teamHeroes(save);
  if (team.length === 0) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  let ok = false;
  g.updateSave((s) => {
    ok = spendEnergy(s.currencies, stage.energy, Date.now());
  });
  if (!ok) {
    g.showToast(tr('campaign.noEnergy', { n: stage.energy }));
    return false;
  }
  const chapter = CHAPTERS[stage.chapter - 1]!;
  g.startBattle({
    title: `${stage.id} · ${stage.name}`,
    subtitle: chapter.name,
    scene: SCENES[stage.chapter - 1] ?? 'mist',
    setup: makeSetup(team.map(heroSpec), stage.waves, newSeed()),
    returnTo: 'campaign',
    finish: (result) => {
      const lines: RewardLine[] = [];
      useGame.getState().updateSave((s) => {
        const r = applyStageResult(s, stageId, result);
        if (r.gold)
          lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
        if (r.shards) lines.push({ icon: 'shards', label: tr('rewards.shards'), value: `+${r.shards}` });
        lines.push({ icon: 'xp', label: tr('rewards.heroXp'), value: `+${formatNumber(r.heroXp)}` });
        if (r.levelUps.length)
          lines.push({ icon: 'level', label: tr('rewards.levelUp'), value: `${r.levelUps.length} гер.` });
        if (r.playerLevelUps)
          lines.push({ icon: 'star', label: tr('rewards.playerLevel'), value: `${s.player.level}` });
      });
      return lines;
    },
    next: () => {
      const n = nextStage(stageId);
      return !!n && startCampaignStage(n.id);
    },
    nextLabel: tr('battle.next'),
    retry: () => startCampaignStage(stageId),
  });
  return true;
}
