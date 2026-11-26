import { heroLevelCap, maxLevel, MAX_STARS } from '@/core/stats';
import { heroDef } from '@/content';
import { SLOTS } from '@/content/gear';
import type { SaveData } from '@/save/schema';
import { teamHeroes } from './battleSetup';
import { heroItems } from './gear';
import { starUpCost } from './heroes';
import { questsReady } from './quests';
import { canClaimLogin } from './login';
import { battlesLeft, canClaimLeague } from './arena';
import { pendingIdle, IDLE_CAP_MS } from './idle';
import { canUpgradeCamp } from './camp';
import { liveopsReady } from './liveops';

/**
 * Красные точки: где игрока ждёт действие. Правило жанра — точка только там,
 * где действие доступно прямо сейчас и ведёт к прогрессу, иначе точки перестают замечать.
 */
export interface Badges {
  /** Герою команды можно поднять уровень томами или звёзды; пустой слот при свободном предмете. */
  heroes: boolean;
  /** В команде меньше пяти героев, хотя героев хватает. */
  team: boolean;
  /** Есть свитки призыва. */
  summon: boolean;
  quests: boolean;
  arena: boolean;
  /** Сундук лагеря заполнен больше чем наполовину. */
  idle: boolean;
  /** Лагерь можно улучшить. */
  campUp: boolean;
  /** Тренировка закончилась или есть свободное место. */
  training: boolean;
  /** Награды событий, пропуска и достижений. */
  liveops: boolean;
}

export function computeBadges(save: SaveData, now: number): Badges {
  const team = teamHeroes(save);
  const freeSlots = new Set(save.items.filter((i) => !i.heroUid).map((i) => i.slot));
  const heroes = team.some((h) => {
    const cap = heroLevelCap(heroDef(h.heroId).rarity, h.stars);
    if (h.level < cap && save.materials.xpTome > 0) return true;
    if (h.level >= maxLevel(h.stars) && h.stars < MAX_STARS) {
      const c = starUpCost(h.stars);
      if (save.currencies.gold >= c.gold && save.materials.starDust >= c.dust) return true;
    }
    const worn = new Set(heroItems(save, h.uid).map((i) => i.slot));
    return SLOTS.some((s) => !worn.has(s) && freeSlots.has(s));
  });
  return {
    heroes,
    team: save.team.length < Math.min(5, save.heroes.length),
    summon: save.materials.scroll > 0,
    quests: questsReady(save, now) > 0 || canClaimLogin(save, now),
    arena: battlesLeft(save, now) > 0 || canClaimLeague(save, now),
    idle: pendingIdle(save, now).ms >= IDLE_CAP_MS / 2,
    campUp: canUpgradeCamp(save) === true,
    training: save.training.slots.some((s) => now >= s.endAt),
    liveops: liveopsReady(save, now) > 0,
  };
}
