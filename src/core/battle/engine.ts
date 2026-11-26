import { affinity } from '../elements';
import { applyBonus, activeFactionBonus, factionCounts } from '../factions';
import { debuffChance, rollDamage } from '../formulas';
import { Rng } from '../rng';
import { baseStats, statsAt } from '../stats';
import {
  DEBUFFS,
  STATUS_POWER,
  type ContentDb,
  type EffectDef,
  type Scope,
  type SkillDef,
  type StatusId,
} from '../content';
import type { Stats } from '../types';
import type { BattleEvent, BattleResult, BattleSetup, BattleUnit, Side, UnitReport, UnitSpec } from './types';
import { chooseAction } from './ai';

export const TM_FULL = 1000;
const DEFAULT_MAX_TURNS = 300;
/** Яд по боссу с общим пулом здоровья: не больше стольких атак отравителя за тик. */
export const POOLED_POISON_ATK = 1.2;
/** Множители боссов поверх обычного роста. */
const BOSS_MULT = { hp: 3.2, atk: 1.15, def: 1.2 };
/** Ранги врагов: элита и чемпионы заметно крепче обычных. */
export const TIER_MULT = {
  normal: { hp: 1, atk: 1, def: 1, spd: 0, acc: 0 },
  elite: { hp: 1.6, atk: 1.2, def: 1.15, spd: 4, acc: 10 },
  champion: { hp: 2.4, atk: 1.35, def: 1.3, spd: 8, acc: 20 },
} as const;

function buildUnit(spec: UnitSpec, side: Side, slot: number, db: ContentDb, uid: string): BattleUnit {
  const def = spec.kind === 'hero' ? db.hero(spec.defId) : db.enemy(spec.defId);
  if (!def) throw new Error(`Нет описания бойца: ${spec.kind}/${spec.defId}`);
  const rarity = 'rarity' in def ? def.rarity : 'common';
  let stats = statsAt(
    baseStats(def.role, rarity, def.mod),
    spec.level,
    spec.stars ?? 1,
    spec.awakened ?? false,
  );
  const boss = spec.boss ?? ('boss' in def && def.boss === true);
  if (boss) {
    stats = {
      ...stats,
      hp: Math.round(stats.hp * BOSS_MULT.hp),
      atk: Math.round(stats.atk * BOSS_MULT.atk),
      def: Math.round(stats.def * BOSS_MULT.def),
    };
  }
  const tier = spec.tier ?? 'normal';
  if (tier !== 'normal') {
    const m = TIER_MULT[tier];
    stats = {
      ...stats,
      hp: Math.round(stats.hp * m.hp),
      atk: Math.round(stats.atk * m.atk),
      def: Math.round(stats.def * m.def),
      spd: stats.spd + m.spd,
      acc: stats.acc + m.acc,
    };
  }
  if (spec.bonusPct) {
    stats = { ...stats };
    for (const [k, v] of Object.entries(spec.bonusPct) as [keyof Stats, number][])
      stats[k] = Math.round(stats[k] * (1 + v));
  }
  if (spec.bonus) {
    stats = { ...stats };
    for (const [k, v] of Object.entries(spec.bonus) as [keyof Stats, number][]) stats[k] += v;
  }
  const skills = def.skills.map((id, i) => {
    const s = db.skill(id);
    if (!s) throw new Error(`Нет навыка ${id} у ${def.id}`);
    return levelSkill(s, spec.skillLv?.[i] ?? 1);
  });
  if (spec.hpMax) stats = { ...stats, hp: Math.round(spec.hpMax) };
  return {
    uid,
    side,
    slot,
    defId: def.id,
    kind: spec.kind,
    name: def.name,
    art: def.art,
    element: spec.element ?? def.element,
    faction: 'faction' in def ? def.faction : undefined,
    role: def.role,
    level: spec.level,
    boss,
    tier,
    stats,
    hp:
      spec.hpNow != null
        ? Math.max(1, Math.min(stats.hp, Math.round(spec.hpNow)))
        : Math.max(1, Math.round(stats.hp * (spec.hpFrac ?? 1))),
    shield: 0,
    shieldTurns: 0,
    tm: 0,
    skills,
    cooldowns: skills.map(() => 0),
    statuses: [],
    alive: true,
    ccImmune: spec.ccImmune ?? false,
    thorns: Math.max(0, Math.min(0.8, spec.thorns ?? ('thorns' in def ? (def.thorns ?? 0) : 0))),
    ...('passive' in def && def.passive ? { passive: def.passive } : {}),
    ...(spec.skin ? { skin: spec.skin } : {}),
    pooled: spec.hpMax != null,
    enrage: spec.enrage ?? 0,
    enrageStacks: 0,
  };
}

/** Навык с учётом уровня: урон, лечение и щиты +10% за уровень выше первого; на 4-м уровне перезарядка −1. */
export function levelSkill(s: SkillDef, lv: number): SkillDef {
  const l = Math.max(1, Math.min(4, Math.floor(lv)));
  if (l === 1) return s;
  const k = 1 + 0.1 * (l - 1);
  return {
    ...s,
    cooldown: l >= 4 && s.cooldown > 1 ? s.cooldown - 1 : s.cooldown,
    effects: s.effects.map((e) =>
      e.kind === 'damage'
        ? { ...e, mult: e.mult * k }
        : e.kind === 'heal' || e.kind === 'shield'
          ? { ...e, pct: e.pct * k }
          : e,
    ),
  };
}

/** Действующие характеристики с учётом баффов и дебаффов. */
export function effective(u: BattleUnit): Stats {
  const has = (id: StatusId) => u.statuses.some((s) => s.id === id);
  const s = { ...u.stats };
  if (has('atkUp')) s.atk *= 1 + STATUS_POWER.atkUp;
  if (has('atkDown')) s.atk *= 1 - STATUS_POWER.atkDown;
  if (has('defUp')) s.def *= 1 + STATUS_POWER.defUp;
  if (has('defDown')) s.def *= 1 - STATUS_POWER.defDown;
  if (has('haste')) s.spd *= 1 + STATUS_POWER.haste;
  if (has('slow')) s.spd *= 1 - STATUS_POWER.slow;
  return s;
}

/**
 * Пошаговый бой. Логика полностью детерминирована seed-ом.
 * Использование: nextActor() → (ручной выбор или chooseAction) → act(); или run() для авто-боя.
 * Всё, что происходит, складывается в log — его проигрывает рендер.
 */
export class Battle {
  readonly rng: Rng;
  readonly log: BattleEvent[] = [];
  units: BattleUnit[] = [];
  wave = 0;
  turn = 0;
  result: BattleResult | null = null;
  private uidSeq = 0;
  private readonly maxTurns: number;
  /** Урон союзников: всего и по каждому. */
  damage = 0;
  readonly damageBy: Record<string, number> = {};
  /** Ходы босса (для боя на время). */
  bossTurns = 0;
  /** Статистика бойцов (переживает смену волн). */
  private readonly stats = new Map<string, UnitReport>();

  constructor(
    readonly setup: BattleSetup,
    readonly db: ContentDb,
  ) {
    this.rng = new Rng(setup.seed);
    this.maxTurns = setup.maxTurns ?? DEFAULT_MAX_TURNS;
    const allies = setup.allies.map((s, i) => buildUnit(s, 'ally', i, db, `a${i}`));
    if (setup.factionBonus !== false) {
      const counts = factionCounts(allies.map((a) => a.faction));
      for (const a of allies) {
        if (!a.faction) continue;
        const bonus = activeFactionBonus(a.faction, counts.get(a.faction) ?? 0);
        if (bonus) {
          a.stats = applyBonus(a.stats, bonus);
          a.hp = Math.round(a.stats.hp * (setup.allies[a.slot]?.hpFrac ?? 1));
        }
      }
    }
    this.units = allies;
    for (const a of allies) this.track(a);
    this.spawnWave(0);
    this.emit({ t: 'start', wave: 1, waves: setup.waves.length });
    this.initPassives(allies);
  }

  get allies() {
    return this.units.filter((u) => u.side === 'ally');
  }
  get enemies() {
    return this.units.filter((u) => u.side === 'enemy');
  }
  unit(uid: string): BattleUnit | undefined {
    return this.units.find((u) => u.uid === uid);
  }
  aliveOf(side: Side): BattleUnit[] {
    return this.units.filter((u) => u.side === side && u.alive);
  }

  private emit(e: BattleEvent) {
    this.log.push(e);
  }

  private spawnWave(index: number) {
    const specs = this.setup.waves[index] ?? [];
    this.units = this.units.filter((u) => u.side === 'ally');
    const spawned = specs.map((s, i) => buildUnit(s, 'enemy', i, this.db, `e${index}_${i}_${this.uidSeq++}`));
    this.units.push(...spawned);
    for (const u of spawned) this.track(u);
    this.wave = index;
    if (index > 0) this.emit({ t: 'wave', wave: index + 1, spawned: spawned.map((u) => u.uid) });
    // Пассивы врагов-героев (арена, PvP); у первой волны — после события start.
    if (index > 0) this.initPassives(spawned);
    else this.pendingPassives = spawned;
  }

  private pendingPassives: BattleUnit[] = [];
  /** Индекс навыка, который сейчас применяется (для пассивов «при обычной атаке»). */
  private curSkill = -1;

  /** Пассивы на старте: шипы, первый ход, стартовые усиления. */
  private initPassives(list: BattleUnit[]) {
    const all = [...list, ...this.pendingPassives];
    this.pendingPassives = [];
    for (const u of all) {
      const p = u.passive;
      if (!p) continue;
      if (p.kind === 'thorns') u.thorns = Math.min(0.8, u.thorns + (p.value ?? 0));
      if (p.kind === 'firstStrike') u.tm = Math.min(TM_FULL, u.tm + (p.value ?? 0) * TM_FULL);
      if (p.kind === 'startStatus' && p.status) {
        const targets = p.allies ? this.aliveOf(u.side) : [u];
        for (const t of targets) this.applyStatus(u, t, p.status, p.turns ?? 2, 1);
      }
    }
  }

  /** Множитель урона от пассива атакующего. */
  private passiveMult(src: BattleUnit, dst: BattleUnit): number {
    const p = src.passive;
    if (!p) return 1;
    const v = p.value ?? 0;
    if (p.kind === 'execute' && dst.hp / dst.stats.hp < 0.35) return 1 + v;
    if (p.kind === 'vsDebuffed' && dst.statuses.some((s) => DEBUFFS.includes(s.id))) return 1 + v;
    if (p.kind === 'desperate' && src.hp / src.stats.hp < 0.5) return 1 + v;
    return 1;
  }

  /** Защита союзников: лучший «страж» среди живых соратников цели (кроме неё самой). */
  private guardOf(dst: BattleUnit): number {
    let g = 0;
    for (const f of this.aliveOf(dst.side))
      if (f !== dst && f.passive?.kind === 'guardian') g = Math.max(g, f.passive.value ?? 0);
    return g;
  }

  /** Продвигает шкалу хода до следующего бойца. Обрабатывает яд и оглушение. null — бой окончен. */
  nextActor(): BattleUnit | null {
    while (!this.result) {
      const alive = this.units.filter((u) => u.alive);
      let best: BattleUnit | null = null;
      let bestT = Infinity;
      for (const u of alive) {
        const spd = Math.max(1, effective(u).spd);
        const t = Math.max(0, (TM_FULL - u.tm) / spd);
        if (t < bestT - 1e-9 || (Math.abs(t - bestT) <= 1e-9 && best && this.tieBreak(u, best))) {
          bestT = t;
          best = u;
        }
      }
      if (!best) return null;
      for (const u of alive) u.tm += Math.max(1, effective(u).spd) * bestT;
      best.tm = 0;
      this.turn += 1;
      if (this.turn > this.maxTurns) {
        this.finish('draw');
        return null;
      }
      this.emit({ t: 'turn', uid: best.uid, turn: this.turn });

      // Яд срабатывает в начале хода носителя и игнорирует защиту и щит.
      for (const p of best.statuses.filter((s) => s.id === 'poison')) {
        if (!best.alive) break;
        const lost = Math.min(best.hp, p.value);
        best.hp = Math.max(0, best.hp - p.value);
        const psrc = this.unit(p.source);
        this.tally(psrc, best, lost);
        this.note(psrc, best, lost, false);
        this.emit({ t: 'poison', uid: best.uid, amount: p.value, hp: best.hp });
        if (best.hp <= 0) {
          if (psrc) this.stat(psrc).kills += 1;
          this.kill(best);
        }
      }
      if (!best.alive) {
        this.checkEnd();
        continue;
      }
      if (best.statuses.some((s) => s.id === 'stun')) {
        this.emit({ t: 'stunned', uid: best.uid });
        this.endTurn(best);
        this.afterTurn(best);
        continue;
      }
      return best;
    }
    return null;
  }

  private tieBreak(a: BattleUnit, b: BattleUnit): boolean {
    const sa = effective(a).spd,
      sb = effective(b).spd;
    if (sa !== sb) return sa > sb;
    if (a.side !== b.side) return a.side === 'ally';
    return a.slot < b.slot;
  }

  /** Прогноз очереди: кто будет ходить следующими (без изменения состояния). */
  previewOrder(count: number): string[] {
    const sim = this.units
      .filter((u) => u.alive)
      .map((u) => ({ u, tm: u.tm, spd: Math.max(1, effective(u).spd) }));
    const out: string[] = [];
    while (out.length < count && sim.length) {
      let best = sim[0]!;
      let bestT = Infinity;
      for (const x of sim) {
        const t = Math.max(0, (TM_FULL - x.tm) / x.spd);
        if (t < bestT - 1e-9 || (Math.abs(t - bestT) <= 1e-9 && this.tieBreak(x.u, best.u))) {
          bestT = t;
          best = x;
        }
      }
      for (const x of sim) x.tm += x.spd * bestT;
      best.tm = 0;
      out.push(best.u.uid);
    }
    return out;
  }

  isReady(u: BattleUnit, skillIndex: number): boolean {
    return (u.cooldowns[skillIndex] ?? 1) <= 0;
  }

  /** Куда можно направить навык. Провокация заставляет бить по себе. */
  validTargets(u: BattleUnit, skill: SkillDef): BattleUnit[] {
    if (skill.target === 'none') return [];
    const side: Side = skill.target === 'enemy' ? (u.side === 'ally' ? 'enemy' : 'ally') : u.side;
    const list = this.aliveOf(side);
    if (skill.target === 'enemy') {
      const taunters = list.filter((x) => x.statuses.some((s) => s.id === 'taunt'));
      if (taunters.length) return taunters;
    }
    return list;
  }

  /** Выполнить ход. Возвращает события этого хода. */
  act(uid: string, skillIndex: number, targetUid?: string): BattleEvent[] {
    const from = this.log.length;
    const u = this.unit(uid);
    if (!u || !u.alive || this.result) throw new Error('act: этот боец не может ходить');
    const skill = u.skills[skillIndex];
    if (!skill) throw new Error('act: нет такого навыка');
    if (!this.isReady(u, skillIndex)) throw new Error('act: навык на перезарядке');

    let target: BattleUnit | undefined;
    if (skill.target !== 'none') {
      const valid = this.validTargets(u, skill);
      target = valid.find((x) => x.uid === targetUid) ?? valid[0];
      if (!target) throw new Error('act: нет доступной цели');
    }

    const touched = new Set<string>();
    const allTargets = (scope: Scope): BattleUnit[] => this.resolveScope(u, scope, target);
    for (const eff of skill.effects) for (const x of allTargets(eff.to ?? 'target')) touched.add(x.uid);
    this.emit({ t: 'skill', uid: u.uid, skill: skill.id, skillIndex, targets: [...touched], fx: skill.fx });
    this.curSkill = skillIndex;

    for (const eff of skill.effects) {
      for (const x of allTargets(eff.to ?? 'target')) {
        if (!x.alive && eff.kind !== 'heal') continue;
        this.applyEffect(u, x, eff);
      }
    }
    u.cooldowns[skillIndex] = skill.cooldown;
    this.endTurn(u);
    this.checkEnd();
    this.afterTurn(u);
    return this.log.slice(from);
  }

  private resolveScope(u: BattleUnit, scope: Scope, target?: BattleUnit): BattleUnit[] {
    const foes = this.aliveOf(u.side === 'ally' ? 'enemy' : 'ally');
    const friends = this.aliveOf(u.side);
    switch (scope) {
      case 'target':
        return target ? [target] : [];
      case 'self':
        return [u];
      case 'allEnemies':
        return foes;
      case 'allAllies':
        return friends;
      case 'otherAllies':
        return friends.filter((f) => f !== u);
      case 'lowestAlly':
        return friends.length
          ? [friends.reduce((a, b) => (a.hp / a.stats.hp <= b.hp / b.stats.hp ? a : b))]
          : [];
      case 'randomEnemies3': {
        const out: BattleUnit[] = [];
        for (let i = 0; i < 3 && foes.length; i++) out.push(this.rng.pick(foes));
        return out;
      }
    }
  }

  private applyEffect(src: BattleUnit, dst: BattleUnit, eff: EffectDef) {
    switch (eff.kind) {
      case 'damage': {
        const hits = eff.hits ?? 1;
        const se = effective(src);
        const de = effective(dst);
        const powerStat = eff.stat ?? 'atk';
        const power = powerStat === 'hp' ? src.stats.hp : se[powerStat];
        const pm = this.passiveMult(src, dst);
        let dealt = 0;
        for (let h = 0; h < hits && dst.alive; h++) {
          const r = rollDamage(
            {
              power,
              multiplier: (eff.mult / hits) * pm,
              def: de.def,
              critRate: se.critRate,
              critDmg: se.critDmg,
              affinity: affinity(src.element, dst.element),
              defIgnore: eff.defIgnore,
            },
            this.rng,
          );
          dealt += this.dealDamage(src, dst, r.amount, r.crit);
        }
        const p = src.passive;
        if (p && src.alive && src.side !== dst.side) {
          if (p.kind === 'lifesteal' && dealt > 0) {
            const before = src.hp;
            src.hp = Math.min(src.stats.hp, src.hp + Math.round(dealt * (p.value ?? 0)));
            if (src.hp > before) {
              this.stat(src).healed += src.hp - before;
              this.emit({ t: 'heal', uid: src.uid, amount: src.hp - before, hp: src.hp });
            }
          }
          if (p.kind === 'onHit' && p.status && this.curSkill === 0 && dst.alive)
            this.applyStatus(src, dst, p.status, p.turns ?? 2, p.chance ?? 0.3);
        }
        return;
      }
      case 'heal': {
        if (!dst.alive) return;
        const boost = src.passive?.kind === 'healBoost' ? 1 + (src.passive.value ?? 0) : 1;
        const amount = Math.round(dst.stats.hp * eff.pct * boost);
        const before = dst.hp;
        dst.hp = Math.min(dst.stats.hp, dst.hp + amount);
        this.stat(src).healed += dst.hp - before;
        this.emit({ t: 'heal', uid: dst.uid, amount: dst.hp - before, hp: dst.hp });
        return;
      }
      case 'shield': {
        const amount = Math.round(src.stats.hp * eff.pct);
        this.stat(src).shielded += Math.max(0, amount - dst.shield);
        dst.shield = Math.max(dst.shield, amount);
        dst.shieldTurns = Math.max(dst.shieldTurns, eff.turns);
        this.emit({ t: 'shield', uid: dst.uid, amount: dst.shield });
        return;
      }
      case 'status':
        this.applyStatus(src, dst, eff.status, eff.turns, eff.chance ?? 1);
        return;
      case 'turnMeter': {
        const before = dst.tm;
        let delta = eff.amount * TM_FULL;
        if (delta < 0 && dst.side !== src.side && dst.ccImmune) {
          this.emit({ t: 'immune', uid: dst.uid, what: 'tm' });
          return;
        }
        // Сбить шкалу хода врагу — это дебафф: проверяем сопротивление.
        if (delta < 0 && dst.side !== src.side) {
          const ch = debuffChance(
            1,
            effective(src).acc,
            effective(dst).res,
            affinity(src.element, dst.element),
          );
          if (!this.rng.chance(ch)) delta = 0;
        }
        dst.tm = Math.max(0, Math.min(TM_FULL, dst.tm + delta));
        this.emit({ t: 'tm', uid: dst.uid, delta: dst.tm - before, tm: dst.tm });
        return;
      }
      case 'cleanse': {
        const removed = dst.statuses.filter((s) => DEBUFFS.includes(s.id)).map((s) => s.id);
        dst.statuses = dst.statuses.filter((s) => !DEBUFFS.includes(s.id));
        if (removed.length) this.emit({ t: 'cleanse', uid: dst.uid, removed });
        return;
      }
    }
  }

  private applyStatus(src: BattleUnit, dst: BattleUnit, id: StatusId, turns: number, baseChance: number) {
    if (!dst.alive) return;
    if (id === 'stun' && dst.ccImmune && dst.side !== src.side) {
      this.emit({ t: 'immune', uid: dst.uid, what: 'stun' });
      return;
    }
    const isDebuff = DEBUFFS.includes(id);
    if (isDebuff && dst.side !== src.side) {
      const ch = debuffChance(
        baseChance,
        effective(src).acc,
        effective(dst).res,
        affinity(src.element, dst.element),
      );
      if (!this.rng.chance(ch)) {
        this.emit({ t: 'status', uid: dst.uid, status: id, turns, landed: false });
        return;
      }
    } else if (baseChance < 1 && !this.rng.chance(baseChance)) {
      return;
    }
    const fresh = src.uid === dst.uid;
    if (id === 'poison') {
      const stacks = dst.statuses.filter((s) => s.id === 'poison');
      if (stacks.length >= STATUS_POWER.poisonStacks) {
        const oldest = stacks.reduce((a, b) => (a.turns <= b.turns ? a : b));
        oldest.turns = Math.max(oldest.turns, turns);
      } else {
        dst.statuses.push({
          id,
          turns,
          value: Math.max(
            1,
            Math.round(
              dst.pooled
                ? Math.min(dst.stats.hp * STATUS_POWER.poison, src.stats.atk * POOLED_POISON_ATK)
                : dst.stats.hp * STATUS_POWER.poison,
            ),
          ),
          source: src.uid,
          fresh,
        });
      }
    } else {
      // Противоположные статусы гасят друг друга.
      const opposite: Partial<Record<StatusId, StatusId>> = {
        atkUp: 'atkDown',
        atkDown: 'atkUp',
        defUp: 'defDown',
        defDown: 'defUp',
        haste: 'slow',
        slow: 'haste',
      };
      const opp = opposite[id];
      if (opp) dst.statuses = dst.statuses.filter((s) => s.id !== opp);
      const cur = dst.statuses.find((s) => s.id === id);
      if (cur) {
        cur.turns = Math.max(cur.turns, turns);
        cur.fresh = cur.fresh || fresh;
      } else dst.statuses.push({ id, turns, value: 0, source: src.uid, fresh });
    }
    if (isDebuff && dst.side !== src.side) this.stat(src).debuffs += 1;
    this.emit({ t: 'status', uid: dst.uid, status: id, turns, landed: true });
  }

  private dealDamage(
    src: BattleUnit,
    dst: BattleUnit,
    amount: number,
    crit: boolean,
    reflect = false,
  ): number {
    if (!reflect && src.side !== dst.side) {
      const g = this.guardOf(dst);
      if (g > 0) amount = Math.max(1, Math.round(amount * (1 - g)));
    }
    let left = amount;
    let absorbed = 0;
    if (dst.shield > 0) {
      absorbed = Math.min(dst.shield, left);
      dst.shield -= absorbed;
      left -= absorbed;
      if (dst.shield <= 0) dst.shieldTurns = 0;
    }
    const lost = Math.min(dst.hp, left);
    dst.hp = Math.max(0, dst.hp - left);
    this.tally(src, dst, lost);
    this.note(src, dst, lost + absorbed, crit);
    if (dst.hp <= 0 && dst.alive) this.stat(src).kills += 1;
    this.emit({
      t: 'damage',
      uid: dst.uid,
      from: src.uid,
      amount,
      absorbed,
      crit,
      affinity: affinity(src.element, dst.element),
      hp: dst.hp,
      ...(reflect ? { reflect: true } : {}),
    });
    if (dst.hp <= 0) this.kill(dst);
    // «Последний рубеж»: впервые ниже 35% — щит и ярость.
    const ls = dst.passive;
    if (ls?.kind === 'lastStand' && !dst.lastStandUsed && dst.alive && dst.hp / dst.stats.hp < 0.35) {
      dst.lastStandUsed = true;
      dst.shield = Math.max(dst.shield, Math.round(dst.stats.hp * (ls.value ?? 0.25)));
      dst.shieldTurns = Math.max(dst.shieldTurns, 2);
      this.emit({ t: 'shield', uid: dst.uid, amount: dst.shield });
      this.applyStatus(dst, dst, 'atkUp', 2, 1);
    }
    // Рывок за добивание.
    if (!dst.alive && src.alive && src.side !== dst.side && src.passive?.kind === 'killRush') {
      const before = src.tm;
      src.tm = Math.min(TM_FULL, src.tm + (src.passive.value ?? 0) * TM_FULL);
      this.emit({ t: 'tm', uid: src.uid, delta: src.tm - before, tm: src.tm });
    }
    // Шипы: часть урона возвращается атакующему (не бесконечно — отражённый урон не отражается снова).
    if (!reflect && dst.thorns > 0 && src.alive && src.side !== dst.side && lost + absorbed > 0) {
      const back = Math.max(1, Math.round((lost + absorbed) * dst.thorns));
      this.dealDamage(dst, src, back, false, true);
    }
    return lost + absorbed;
  }

  private track(u: BattleUnit) {
    this.stats.set(u.uid, {
      uid: u.uid,
      name: u.name,
      art: u.art,
      side: u.side,
      element: u.element,
      dealt: 0,
      taken: 0,
      healed: 0,
      shielded: 0,
      crits: 0,
      maxCrit: 0,
      kills: 0,
      debuffs: 0,
      alive: true,
    });
  }
  private stat(u: BattleUnit): UnitReport {
    if (!this.stats.has(u.uid)) this.track(u);
    return this.stats.get(u.uid)!;
  }
  /** Статистика удара: урон источнику, полученный урон цели, криты. */
  private note(src: BattleUnit | undefined, dst: BattleUnit, amount: number, crit: boolean) {
    this.stat(dst).taken += amount;
    if (!src || src.side === dst.side) return;
    const s = this.stat(src);
    s.dealt += amount;
    if (crit) {
      s.crits += 1;
      s.maxCrit = Math.max(s.maxCrit, amount);
    }
  }

  /** Отчёт по бойцам на текущий момент. */
  report(): UnitReport[] {
    return [...this.stats.values()].map((r) => ({ ...r, alive: this.unit(r.uid)?.alive ?? false }));
  }

  /** Учёт урона союзников по врагам. */
  private tally(src: BattleUnit | undefined, dst: BattleUnit, lost: number) {
    if (!src || src.side !== 'ally' || dst.side !== 'enemy' || lost <= 0) return;
    this.damage += lost;
    this.damageBy[src.uid] = (this.damageBy[src.uid] ?? 0) + lost;
  }

  /** После хода: ярость босса и лимит ходов босса. */
  private afterTurn(u: BattleUnit) {
    if (u.side !== 'enemy' || !u.boss) return;
    this.bossTurns += 1;
    if (u.alive && u.enrage > 0) {
      u.enrageStacks += 1;
      u.stats = { ...u.stats, atk: Math.round(u.stats.atk * (1 + u.enrage)) };
      this.emit({ t: 'enrage', uid: u.uid, stacks: u.enrageStacks, atk: u.stats.atk });
    }
    const limit = this.setup.bossTurns;
    if (limit && this.bossTurns >= limit && !this.result) this.finish('draw');
  }

  /** Игрок сдаётся (бой на время: урон засчитывается). */
  surrender() {
    if (this.result) return;
    this.finish('enemy', true);
  }

  private kill(u: BattleUnit) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    u.statuses = [];
    u.shield = 0;
    u.tm = 0;
    this.emit({ t: 'death', uid: u.uid });
  }

  /** Конец хода: тикают длительности статусов, щита и перезарядки. */
  private endTurn(u: BattleUnit) {
    for (let i = 0; i < u.cooldowns.length; i++) u.cooldowns[i] = Math.max(0, (u.cooldowns[i] ?? 0) - 1);
    const keep = [];
    for (const s of u.statuses) {
      if (s.fresh) {
        s.fresh = false;
        keep.push(s);
        continue;
      }
      s.turns -= 1;
      if (s.turns > 0) keep.push(s);
      else this.emit({ t: 'statusEnd', uid: u.uid, status: s.id });
    }
    u.statuses = keep;
    if (u.shieldTurns > 0) {
      u.shieldTurns -= 1;
      if (u.shieldTurns === 0 && u.shield > 0) u.shield = 0;
    }
  }

  private checkEnd() {
    if (this.result) return;
    if (this.aliveOf('ally').length === 0) return this.finish('enemy');
    if (this.aliveOf('enemy').length === 0) {
      if (this.wave + 1 < this.setup.waves.length) {
        // Новая волна: союзники сохраняют HP, но шкала хода обнуляется у всех.
        this.spawnWave(this.wave + 1);
        for (const a of this.allies) a.tm = 0;
        return;
      }
      this.finish('ally');
    }
  }

  private finish(winner: Side | 'draw', surrendered = false) {
    const alliesAlive = this.aliveOf('ally').length;
    const lost = this.setup.allies.length - alliesAlive;
    const stars = winner === 'ally' ? (Math.max(1, 3 - lost) as 1 | 2 | 3) : 0;
    this.result = {
      winner,
      stars,
      turns: this.turn,
      alliesAlive,
      damage: this.damage,
      damageBy: { ...this.damageBy },
      bossTurns: this.bossTurns,
      report: this.report(),
      ...(surrendered ? { surrendered } : {}),
    };
    this.emit({ t: 'end', winner, stars, turns: this.turn });
  }

  /** Авто-бой до конца. */
  run(): BattleResult {
    for (;;) {
      const u = this.nextActor();
      if (!u) break;
      const a = chooseAction(this, u);
      this.act(u.uid, a.skillIndex, a.targetUid);
    }
    return this.result!;
  }
}

/** Удобный запуск авто-боя целиком. */
export function simulate(
  setup: BattleSetup,
  db: ContentDb,
): { result: BattleResult; log: BattleEvent[]; battle: Battle } {
  const battle = new Battle(setup, db);
  const result = battle.run();
  return { result, log: battle.log, battle };
}
