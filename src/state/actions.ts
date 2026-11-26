import {
  stageById,
  nextStage,
  CHAPTERS,
  dungeonDef,
  dungeonEnergy,
  dungeonWaves,
  DUNGEON_LEVELS,
  SETS,
  SLOT_NAME,
  type DungeonId,
  type Slot,
} from '@/content';
import {
  applyStageResult,
  applyDungeonResult,
  isDungeonLevelUnlocked,
  isStageUnlocked,
  makeSetup,
  heroSpec,
  spendEnergy,
  teamHeroes,
} from '@/game';
import { formatNumber, tr } from '@/i18n';
import { simulate, type BattleResult } from '@/core/battle';
import { db } from '@/content';
import { INVENTORY_LIMIT } from '@/game';
import { mergeRewardLines } from './rewards';
import { useGame, type RewardLine } from './store';
import {
  trackQuest,
  applyTowerResult,
  towerWaves,
  towerScene,
  startArenaBattle,
  applyArenaResult,
  type ArenaOpponent,
} from '@/game';

const SCENES = ['mist', 'cathedral', 'forge', 'dusk'] as const;

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
    setup: makeSetup(
      team.map((h) => heroSpec(h, save)),
      stage.waves,
      newSeed(),
    ),
    returnTo: 'campaign',
    repeatable: true,
    finish: (result) => campaignFinish(stageId, result),
    next: () => {
      const n = nextStage(stageId);
      return !!n && startCampaignStage(n.id);
    },
    nextLabel: tr('battle.next'),
    retry: () => startCampaignStage(stageId),
  });
  return true;
}

/** Запуск уровня подземелья. */
export function startDungeon(id: DungeonId, level: number): boolean {
  const g = useGame.getState();
  const save = g.save!;
  const d = dungeonDef(id);
  if (!isDungeonLevelUnlocked(save, id, level)) return false;
  const team = teamHeroes(save);
  if (team.length === 0) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  const cost = dungeonEnergy(level);
  let ok = false;
  g.updateSave((s) => {
    ok = spendEnergy(s.currencies, cost, Date.now());
  });
  if (!ok) {
    g.showToast(tr('campaign.noEnergy', { n: cost }));
    return false;
  }
  g.startBattle({
    title: `${d.name} · ${tr('dungeons.level', { n: level })}`,
    subtitle: tr('dungeons.title'),
    scene: d.scene,
    setup: makeSetup(
      team.map((h) => heroSpec(h, save)),
      dungeonWaves(d, level),
      newSeed(),
    ),
    returnTo: 'dungeons',
    repeatable: true,
    finish: (result) => dungeonFinish(id, level, result),
    next: () => startDungeon(id, Math.min(DUNGEON_LEVELS, level + 1)),
    nextLabel: tr('battle.next'),
    retry: () => startDungeon(id, level),
  });
  return true;
}

function itemLine(it: { slot: string; set: string; rarity: string }): RewardLine {
  return {
    icon: 'item',
    label: `${SLOT_NAME[it.slot as Slot]} · ${SETS.find((x) => x.id === it.set)?.name ?? ''}`,
    value: tr(`labels.rarity.${it.rarity}`),
  };
}

/** Итог этапа кампании: применяет результат к сейву и возвращает строки наград. */
export function campaignFinish(stageId: string, result: BattleResult): RewardLine[] {
  const lines: RewardLine[] = [];
  useGame.getState().updateSave((s) => {
    const r = applyStageResult(s, stageId, result);
    if (result.winner === 'ally') trackQuest(s, 'campaign');
    if (r.gold) lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
    if (r.shards) lines.push({ icon: 'shards', label: tr('rewards.shards'), value: `+${r.shards}` });
    lines.push({ icon: 'xp', label: tr('rewards.heroXp'), value: `+${formatNumber(r.heroXp)}` });
    if (r.levelUps.length)
      lines.push({ icon: 'level', label: tr('rewards.levelUp'), value: `${r.levelUps.length} гер.` });
    if (r.playerLevelUps)
      lines.push({ icon: 'star', label: tr('rewards.playerLevel'), value: `${s.player.level}` });
    for (const it of r.items) lines.push(itemLine(it));
    if (r.ore) lines.push({ icon: 'star', label: tr('labels.material.ore'), value: `+${r.ore}` });
  });
  return lines;
}

/** Итог уровня подземелья. */
export function dungeonFinish(id: DungeonId, level: number, result: BattleResult): RewardLine[] {
  const lines: RewardLine[] = [];
  useGame.getState().updateSave((s) => {
    const r = applyDungeonResult(s, id, level, result);
    if (result.winner === 'ally') trackQuest(s, 'dungeon');
    if (r.gold) lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
    for (const it of r.items) lines.push(itemLine(it));
    for (const [m, n] of Object.entries(r.materials))
      lines.push({ icon: 'star', label: tr(`labels.material.${m}`), value: `×${n}` });
    if (r.firstClear) lines.push({ icon: 'shards', label: tr('rewards.shards'), value: '+20' });
  });
  return lines;
}

export type SweepStop = 'done' | 'energy' | 'defeat' | 'full';

/**
 * Зачистка: бои считаются мгновенно, без анимации, по тем же правилам и наградам.
 * Доступна для этапов на 3★ и пройденных уровней подземелий.
 */
function sweep(
  times: number,
  cost: number,
  run: (seed: number) => { result: BattleResult; lines: RewardLine[] },
  title: string,
): { done: number; stop: SweepStop } {
  const g = useGame.getState();
  const all: RewardLine[][] = [];
  let stop: SweepStop = 'done';
  let done = 0;
  for (let i = 0; i < times; i++) {
    if (useGame.getState().save!.items.length >= INVENTORY_LIMIT) {
      stop = 'full';
      break;
    }
    let ok = false;
    g.updateSave((s) => {
      ok = spendEnergy(s.currencies, cost, Date.now());
    });
    if (!ok) {
      stop = 'energy';
      break;
    }
    const { result, lines } = run(newSeed());
    all.push(lines);
    done++;
    if (result.winner !== 'ally') {
      stop = 'defeat';
      break;
    }
  }
  g.showSummary({
    title,
    note: tr(`sweep.stop.${stop}`, { n: done }),
    lines: mergeRewardLines(all),
  });
  return { done, stop };
}

export function canSweepStage(stageId: string): boolean {
  return (useGame.getState().save?.campaign.stars[stageId] ?? 0) >= 1;
}

export function sweepCampaignStage(stageId: string, times: number) {
  const stage = stageById(stageId)!;
  const save = useGame.getState().save!;
  const team = teamHeroes(save);
  if (!team.length) {
    useGame.getState().showToast(tr('campaign.noTeam'));
    return null;
  }
  return sweep(
    times,
    stage.energy,
    (seed) => {
      const sv = useGame.getState().save!;
      const { result } = simulate(
        makeSetup(
          teamHeroes(sv).map((h) => heroSpec(h, sv)),
          stage.waves,
          seed,
        ),
        db,
      );
      return { result, lines: campaignFinish(stageId, result) };
    },
    tr('sweep.title', { name: `${stage.id} · ${stage.name}` }),
  );
}

export function canSweepDungeon(id: DungeonId, level: number): boolean {
  return (useGame.getState().save?.dungeons[id] ?? 0) >= level;
}

export function sweepDungeon(id: DungeonId, level: number, times: number) {
  const d = dungeonDef(id);
  const save = useGame.getState().save!;
  if (!teamHeroes(save).length) {
    useGame.getState().showToast(tr('campaign.noTeam'));
    return null;
  }
  return sweep(
    times,
    dungeonEnergy(level),
    (seed) => {
      const sv = useGame.getState().save!;
      const { result } = simulate(
        makeSetup(
          teamHeroes(sv).map((h) => heroSpec(h, sv)),
          dungeonWaves(d, level),
          seed,
        ),
        db,
      );
      return { result, lines: dungeonFinish(id, level, result) };
    },
    tr('sweep.title', { name: `${d.name} · ${tr('dungeons.level', { n: level })}` }),
  );
}

/** Этаж башни. Энергию не тратит. */
export function startTower(floor: number): boolean {
  const g = useGame.getState();
  const save = g.save!;
  if (floor > save.tower.floor + 1) return false;
  const team = teamHeroes(save);
  if (team.length === 0) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  g.startBattle({
    title: tr('tower.floor', { n: floor }),
    subtitle: tr('tower.title'),
    scene: towerScene(floor),
    setup: makeSetup(
      team.map((h) => heroSpec(h, save)),
      towerWaves(floor),
      newSeed(),
    ),
    returnTo: 'tower',
    finish: (result) => {
      const lines: RewardLine[] = [];
      useGame.getState().updateSave((s) => {
        const r = applyTowerResult(s, floor, result, Date.now());
        if (result.winner === 'ally') trackQuest(s, 'tower');
        if (r?.gold)
          lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
        if (r?.shards) lines.push({ icon: 'shards', label: tr('rewards.shards'), value: `+${r.shards}` });
        for (const [m, n] of Object.entries(r?.materials ?? {}))
          lines.push({ icon: 'star', label: tr(`labels.material.${m}`), value: `×${n}` });
        if (r?.item) {
          const it = r.item;
          lines.push({
            icon: 'item',
            label: `${SLOT_NAME[it.slot as Slot]} · ${SETS.find((x) => x.id === it.set)?.name ?? ''}`,
            value: tr(`labels.rarity.${it.rarity}`),
          });
        }
      });
      return lines;
    },
    next: () => startTower(floor + 1),
    nextLabel: tr('tower.next'),
    retry: () => startTower(floor),
  });
  return true;
}

/** Бой на арене против команды-ИИ. */
export function startArena(opp: ArenaOpponent): boolean {
  const g = useGame.getState();
  const save = g.save!;
  const team = teamHeroes(save);
  if (team.length === 0) {
    g.showToast(tr('campaign.noTeam'));
    return false;
  }
  let res: true | string = true;
  g.updateSave((s) => {
    res = startArenaBattle(s, Date.now());
  });
  if (res !== true) {
    g.showToast(tr('arena.noTickets'));
    return false;
  }
  const scenes = ['mist', 'cathedral', 'forge'] as const;
  g.startBattle({
    title: opp.name,
    subtitle: tr('arena.title'),
    scene: scenes[opp.rating % 3]!,
    setup: { allies: team.map((h) => heroSpec(h, save)), waves: [opp.team], seed: newSeed() },
    returnTo: 'arena',
    finish: (result) => {
      const lines: RewardLine[] = [];
      useGame.getState().updateSave((s) => {
        const r = applyArenaResult(s, opp, result);
        trackQuest(s, 'arena');
        lines.push({
          icon: 'star',
          label: tr('arena.rating'),
          value: `${r.delta > 0 ? '+' : ''}${r.delta} → ${s.arena.rating}`,
        });
        lines.push({ icon: 'gold', label: tr('rewards.gold'), value: `+${formatNumber(r.gold)}` });
      });
      return lines;
    },
  });
  return true;
}
