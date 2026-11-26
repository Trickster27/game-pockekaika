import {
  Application,
  Assets,
  ColorMatrixFilter,
  Container,
  Graphics,
  Sprite,
  Text,
  type Texture,
} from 'pixi.js';
import { skinDef } from '@/content/skins';
import type { Battle, BattleEvent, BattleUnit } from '@/core/battle';
import type { Element } from '@/core/types';
import type { StatusId } from '@/core/content';
import { DEBUFFS } from '@/core/content';
import {
  rigValue,
  unitArtMeta,
  unitArtUrl,
  unitRig,
  unitRigInfo,
  UNIT_FRAME,
  type RigPart,
} from '@/assets/art';
import type { IdleStyle } from '@/assets/art/meta';
import { FIELD, sceneTexture, SCENE_TINT, type SceneKey } from './background';
import { glowTexture, statusLabel, statusTexture } from './textures';
import { tr } from '@/i18n';

const LEAD = 0x0a0710;
const FONT = 'Philosopher, Georgia, serif';

export const ELEMENT_COLOR: Record<Element, string> = {
  fire: '#ff7a2a',
  thorn: '#7fd08a',
  stone: '#c9a46a',
  tide: '#4fd6e0',
  light: '#fff0b8',
  dark: '#a37cff',
};

type Pos = [number, number, number];
const ALLY_POS: Pos[] = [
  [118, 404, 1],
  [242, 404, 1],
  [58, 500, 0.95],
  [180, 503, 0.95],
  [302, 500, 0.95],
];
const EP: Record<string, Pos> = {
  fl: [118, 250, 0.95],
  fr: [242, 250, 0.95],
  bl: [68, 170, 0.85],
  bc: [180, 182, 1],
  br: [292, 170, 0.85],
};
const ENEMY_LAYOUT = [
  [],
  ['bc'],
  ['fl', 'fr'],
  ['fl', 'bc', 'fr'],
  ['fl', 'fr', 'bl', 'br'],
  ['fl', 'fr', 'bl', 'bc', 'br'],
];

const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const easeIn = (k: number) => k * k * k;
const easeInOut = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeBack = (k: number) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

interface UnitView {
  uid: string;
  side: 'ally' | 'enemy';
  boss: boolean;
  tier: 'normal' | 'elite' | 'champion';
  idle: IdleStyle;
  lean: number;
  aura: Graphics;
  element: Element;
  x: number;
  y: number;
  scale: number;
  top: number;
  ox: number;
  oy: number;
  pulse: number;
  phase: number;
  flash: number;
  alpha: number;
  hp: number;
  maxHp: number;
  hpShown: number;
  hpTrail: number;
  shield: number;
  tm: number;
  statuses: StatusId[];
  alive: boolean;
  active: boolean;
  targetable: boolean;
  name: string;
  root: Container;
  shadow: Graphics;
  ring: Graphics;
  sprite: Sprite;
  flashSprite: Sprite;
  /** Слои «живого» героя (если есть). */
  rig?: { part: RigPart; holder: Container; sprite: Sprite; fall?: { vx: number; vy: number; vr: number } }[];
  /** Точка руки/оружия в координатах кадра. */
  hand?: [number, number];
  /** Позы 0..1: каст (рука вверх), прицел (рука вперёд), попадание (отшатнуться), распад при смерти. */
  cast: number;
  aim: number;
  hit: number;
  dying: number;
  bars: Graphics;
  icons: Container;
  label?: Text;
}

interface Particle {
  d: Container;
  vx: number;
  vy: number;
  g: number;
  drag: number;
  life: number;
  max: number;
  grow: number;
  spin: number;
  baseScale: number;
  fade: boolean;
}

interface Fx {
  start: number;
  dur: number;
  g: Graphics;
  draw: (g: Graphics, k: number) => void;
}

interface Tween {
  start: number;
  dur: number;
  from: number;
  to: number;
  set: (v: number) => void;
  ease: (k: number) => number;
  done: () => void;
}

export interface BattleViewOptions {
  scene: SceneKey;
  onUnitTap?: (uid: string) => void;
  onImpact?: (kind: 'hit' | 'crit' | 'heal' | 'death', element?: Element) => void;
}

/**
 * Визуализация боя на PixiJS. Сама логика боя живёт в core: здесь только проигрывание событий.
 * Скорость (×1/×2/×3) ускоряет всё игровое время сцены, включая паузы и частицы.
 */
export class BattleView {
  speed = 1;
  private app!: Application;
  private world = new Container();
  private layerUnits = new Container();
  private layerFxUnder = new Container();
  private layerFx = new Container();
  private layerUi = new Container();
  private flashG = new Graphics();
  private views = new Map<string, UnitView>();
  private textures = new Map<string, Texture>();
  private parts: Particle[] = [];
  private fxs: Fx[] = [];
  private tweens: Tween[] = [];
  private timers: { at: number; res: () => void }[] = [];
  private time = 0;
  private shake = 0;
  private flashA = 0;
  private flashColor = '#ffffff';
  private amb = 0;
  private destroyed = false;
  private onVis = () => (document.hidden ? this.app.ticker.stop() : this.app.ticker.start());

  private constructor(private readonly opts: BattleViewOptions) {}

  static async create(host: HTMLElement, opts: BattleViewOptions): Promise<BattleView> {
    const v = new BattleView(opts);
    const app = new Application();
    await app.init({
      resizeTo: host,
      background: 0x15122a,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      preference: 'webgl',
    });
    app.ticker.maxFPS = 60;
    host.appendChild(app.canvas);
    v.app = app;
    const bg = new Sprite(sceneTexture(opts.scene));
    bg.width = FIELD.width + 16;
    bg.height = FIELD.height + 16;
    bg.position.set(-8, -8);
    v.world.addChild(bg, v.layerFxUnder, v.layerUnits, v.layerFx, v.layerUi);
    app.stage.addChild(v.world, v.flashG);
    v.layout();
    app.renderer.on('resize', () => v.layout());
    app.ticker.add((t) => v.update(t.deltaMS));
    document.addEventListener('visibilitychange', v.onVis);
    return v;
  }

  setPaused(p: boolean) {
    if (p) this.app.ticker.stop();
    else if (!document.hidden) this.app.ticker.start();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    document.removeEventListener('visibilitychange', this.onVis);
    for (const t of this.timers) t.res();
    this.app.destroy({ removeView: true }, { children: true });
  }

  private layout() {
    const w = this.app.screen.width,
      h = this.app.screen.height;
    const k = Math.min(w / FIELD.width, h / FIELD.height);
    this.world.scale.set(k);
    this.world.position.set((w - FIELD.width * k) / 2, (h - FIELD.height * k) / 2);
  }

  // ———————————————————— время ————————————————————

  wait(ms: number): Promise<void> {
    if (this.destroyed) return Promise.resolve();
    return new Promise((res) => this.timers.push({ at: this.time + ms, res }));
  }

  private tween(
    set: (v: number) => void,
    from: number,
    to: number,
    dur: number,
    ease = easeOut,
  ): Promise<void> {
    return new Promise((done) =>
      this.tweens.push({ start: this.time, dur: Math.max(1, dur), from, to, set, ease, done }),
    );
  }

  // ———————————————————— юниты ————————————————————

  async loadArt(keys: string[]) {
    await Promise.all(
      [...new Set(keys)].map(async (k) => {
        if (this.textures.has(k)) return;
        const url = unitArtUrl(k) ?? unitArtUrl('knight')!;
        this.textures.set(k, await Assets.load<Texture>({ src: url, data: { resolution: 2 } }));
        for (const part of unitRig(k) ?? [])
          this.textures.set(
            `${k}/${part.id}`,
            await Assets.load<Texture>({ src: part.url, data: { resolution: 2 } }),
          );
      }),
    );
  }

  /** Создаёт виды для всех бойцов боя (союзники + текущая волна). */
  async setUnits(units: BattleUnit[]) {
    await this.loadArt(units.map((u) => u.art));
    for (const v of [...this.views.values()]) this.removeView(v);
    const allies = units.filter((u) => u.side === 'ally');
    const enemies = units.filter((u) => u.side === 'enemy');
    allies.forEach((u, i) => this.addView(u, ALLY_POS[Math.min(i, 4)]!));
    this.placeEnemies(enemies);
  }

  private placeEnemies(enemies: BattleUnit[]) {
    const layout = ENEMY_LAYOUT[Math.min(5, enemies.length)]!;
    enemies.forEach((u, i) => this.addView(u, EP[layout[i] ?? 'bc']!));
  }

  private removeView(v: UnitView) {
    v.root.destroy({ children: true });
    v.bars.destroy();
    v.icons.destroy({ children: true });
    v.label?.destroy();
    this.views.delete(v.uid);
  }

  private addView(u: BattleUnit, pos: Pos) {
    const tex = this.textures.get(u.art)!;
    const meta = unitArtMeta(u.art);
    const scale = pos[2] * meta.scale * (u.tier === 'champion' ? 1.1 : 1);
    const root = new Container();
    root.position.set(pos[0], pos[1]);
    const shadow = new Graphics()
      .ellipse(0, 0, 22 * scale * (u.boss ? 1.6 : 1), 6 * scale)
      .fill({ color: 0x05030a, alpha: 0.45 });
    const ring = new Graphics();
    const sprite = new Sprite(tex);
    sprite.anchor.set(UNIT_FRAME.footX / UNIT_FRAME.width, UNIT_FRAME.footY / UNIT_FRAME.height);
    const k = (UNIT_FRAME.height * scale) / tex.height;
    sprite.scale.set(k);
    const flashSprite = new Sprite(tex);
    flashSprite.anchor.copyFrom(sprite.anchor);
    flashSprite.scale.set(k);
    flashSprite.blendMode = 'add';
    flashSprite.alpha = 0;
    const body = new Container();
    // «Живой» герой: слои с точками вращения поверх невидимого цельного спрайта
    // (он остаётся для нажатий, вспышки удара и шлейфа).
    const rigParts = unitRig(u.art);
    let rig: UnitView['rig'];
    if (rigParts) {
      sprite.alpha = 0;
      const rc = new Container();
      rig = rigParts.map((part) => {
        const ptex = this.textures.get(`${u.art}/${part.id}`) ?? tex;
        const ps = new Sprite(ptex);
        ps.anchor.copyFrom(sprite.anchor);
        ps.scale.set((UNIT_FRAME.height * scale) / ptex.height);
        const holder = new Container();
        holder.position.set(part.pivot[0] * scale, part.pivot[1] * scale);
        ps.position.set(-part.pivot[0] * scale, -part.pivot[1] * scale);
        holder.addChild(ps);
        rc.addChild(holder);
        return { part, holder, sprite: ps };
      });
      body.addChild(sprite, rc, flashSprite);
    } else body.addChild(sprite, flashSprite);
    // Облик: перекраска модели цветовой матрицей (те же параметры, что у CSS-фильтра в интерфейсе).
    const skin = skinDef(u.skin);
    if (skin) {
      const f = new ColorMatrixFilter();
      if (skin.sepia) f.sepia(true);
      f.hue(skin.hue, true);
      f.saturate(skin.saturate, true);
      if (skin.brightness) f.brightness(skin.brightness, true);
      body.filters = [f];
    }
    const aura = new Graphics();
    aura.blendMode = 'add';
    root.addChild(shadow, aura, ring, body);
    sprite.eventMode = 'static';
    sprite.cursor = 'pointer';
    sprite.on('pointertap', () => this.opts.onUnitTap?.(u.uid));
    this.layerUnits.addChild(root);
    this.layerUnits.children.sort((a, b) => a.y - b.y);
    const bars = new Graphics();
    const icons = new Container();
    this.layerUi.addChild(bars, icons);
    let label: Text | undefined;
    const tierText = u.boss
      ? u.name
      : u.tier === 'champion'
        ? tr('fx.champion')
        : u.tier === 'elite'
          ? tr('fx.elite')
          : '';
    if (tierText) {
      label = new Text({
        text: tierText,
        style: {
          fontFamily: FONT,
          fontWeight: '700',
          fontSize: u.boss ? 11 : 10,
          fill: u.boss ? '#e6d4ff' : u.tier === 'champion' ? '#ffd36b' : '#e6ecf5',
          stroke: { color: LEAD, width: 3, join: 'round' },
        },
      });
      label.anchor.set(0.5, 1);
      this.layerUi.addChild(label);
    }
    const v: UnitView = {
      uid: u.uid,
      side: u.side,
      boss: u.boss,
      tier: u.tier ?? 'normal',
      idle: meta.idle ?? 'bob',
      lean: 0,
      aura,
      element: u.element,
      x: pos[0],
      y: pos[1],
      scale,
      top: meta.top * scale,
      ox: 0,
      oy: 0,
      pulse: 1,
      phase: Math.random() * 6,
      flash: 0,
      alpha: 1,
      hp: u.hp,
      maxHp: u.stats.hp,
      hpShown: u.hp,
      hpTrail: u.hp,
      shield: u.shield,
      tm: u.tm,
      statuses: u.statuses.map((s) => s.id),
      alive: u.alive,
      active: false,
      targetable: false,
      name: u.name,
      root,
      shadow,
      ring,
      sprite,
      flashSprite,
      rig,
      hand: unitRigInfo(u.art)?.hand,
      cast: 0,
      aim: 0,
      hit: 0,
      dying: 0,
      bars,
      icons,
      label,
    };
    this.views.set(u.uid, v);
    return v;
  }

  /** Синхронизация с состоянием движка (на случай, если анимации что-то не показали). */
  sync(battle: Battle) {
    for (const u of battle.units) {
      const v = this.views.get(u.uid);
      if (!v) continue;
      v.hp = u.hp;
      v.maxHp = u.stats.hp;
      v.shield = u.shield;
      v.tm = u.tm;
      v.statuses = u.statuses.map((s) => s.id);
      if (!u.alive && v.alive) this.shatter(v);
    }
  }

  setActive(uid: string | null) {
    for (const v of this.views.values()) v.active = v.uid === uid;
  }

  setTargetable(uids: string[]) {
    const set = new Set(uids);
    for (const v of this.views.values()) v.targetable = set.has(v.uid);
  }

  // ———————————————————— проигрывание событий ————————————————————

  async play(events: BattleEvent[], battle: Battle) {
    let i = 0;
    while (i < events.length && !this.destroyed) {
      const e = events[i]!;
      switch (e.t) {
        case 'turn': {
          this.setActive(e.uid);
          const u = battle.unit(e.uid);
          const v = this.views.get(e.uid);
          if (u && v) v.tm = 0;
          i++;
          break;
        }
        case 'poison': {
          const v = this.views.get(e.uid);
          if (v) {
            this.burst(v.x, v.y - v.top * 0.5, 14, ['#8be37a', '#3f8a4e'], {
              sp: [30, 110],
              life: [400, 700],
              size: [4, 8],
              g: -60,
            });
            this.floatText(v, `−${fmt(e.amount)}`, '#8be37a', 16);
            v.hp = e.hp;
          }
          await this.wait(320);
          i++;
          break;
        }
        case 'stunned': {
          const v = this.views.get(e.uid);
          if (v) this.label(v, tr('fx.stunned'), '#ffd84a');
          await this.wait(420);
          i++;
          break;
        }
        case 'skill': {
          const chunk: BattleEvent[] = [];
          let j = i + 1;
          while (j < events.length && !['turn', 'skill', 'wave', 'end', 'start'].includes(events[j]!.t))
            chunk.push(events[j++]!);
          await this.playSkill(e, chunk, battle);
          i = j;
          break;
        }
        case 'wave': {
          await this.wait(350);
          const old = [...this.views.values()].filter((v) => v.side === 'enemy');
          for (const v of old) this.removeView(v);
          const fresh = e.spawned.map((uid) => battle.unit(uid)).filter((u): u is BattleUnit => !!u);
          await this.loadArt(fresh.map((u) => u.art));
          this.placeEnemies(fresh);
          for (const uid of e.spawned) {
            const v = this.views.get(uid);
            if (!v) continue;
            v.alpha = 0;
            v.pulse = 0.5;
            void this.tween((x) => (v.alpha = x), 0, 1, 350);
            void this.tween((x) => (v.pulse = x), 0.5, 1, 450, easeBack);
            this.burst(v.x, v.y - 20, 14, [this.sceneTint()], {
              sp: [20, 80],
              life: [500, 900],
              size: [8, 14],
              g: -40,
              alpha: 0.6,
            });
          }
          this.banner(tr('fx.wave', { n: e.wave }), this.sceneTint());
          await this.wait(800);
          i++;
          break;
        }
        case 'death': {
          const v = this.views.get(e.uid);
          if (v) this.shatter(v);
          i++;
          break;
        }
        default:
          i++;
      }
    }
    this.sync(battle);
  }

  private sceneTint() {
    return SCENE_TINT[this.opts.scene];
  }

  private async playSkill(e: Extract<BattleEvent, { t: 'skill' }>, chunk: BattleEvent[], battle: Battle) {
    const actor = this.views.get(e.uid);
    const unit = battle.unit(e.uid);
    if (!actor || !unit) return;
    const skill = unit.skills[e.skillIndex];
    const byUid = new Map<string, BattleEvent[]>();
    for (const ev of chunk) {
      if (!('uid' in ev)) continue;
      const arr = byUid.get(ev.uid) ?? [];
      arr.push(ev);
      byUid.set(ev.uid, arr);
    }
    const color = ELEMENT_COLOR[actor.element];
    const foes = e.targets
      .map((t) => this.views.get(t))
      .filter((v): v is UnitView => !!v && v.side !== actor.side);
    const friends = e.targets
      .map((t) => this.views.get(t))
      .filter((v): v is UnitView => !!v && v.side === actor.side);
    if (e.skillIndex > 0 && skill) this.banner(skill.name, color);

    // Эффекты на себя и союзников, если навык атакующий, применяем в момент каста.
    const applyFriends = async () => {
      for (const f of friends) await this.applyTo(f, byUid.get(f.uid) ?? [], actor);
    };

    const fx = e.fx ?? (foes.length ? 'slash' : 'buff');
    switch (fx) {
      case 'slash':
      case 'hammer':
        if (foes.length === 1) await this.fxDash(actor, foes[0]!, color, byUid);
        else await this.fxShockwave(actor, foes, color, byUid);
        await applyFriends();
        break;
      case 'arrow':
      case 'ray':
      case 'volley':
        await applyFriends();
        await this.fxProjectiles(
          actor,
          foes,
          color,
          byUid,
          fx === 'volley' ? -70 : fx === 'arrow' ? -45 : 0,
          fx === 'ray' ? 'orb' : 'arrow',
        );
        break;
      case 'fire':
        await this.charge(actor, ['#ff7a2a', '#ffb347']);
        await applyFriends();
        await this.fxFirePillars(foes, byUid);
        break;
      case 'pillars':
        await this.charge(actor, ['#fff0b8', '#f0c860']);
        await applyFriends();
        await this.fxLightPillars(foes, byUid);
        break;
      case 'meteor':
        await this.charge(actor, ['#ff7a2a', '#ffb347']);
        await applyFriends();
        await this.fxMeteors(foes, byUid);
        break;
      case 'wave':
      case 'shockwave':
      case 'tide':
      case 'quake':
      case 'storm': {
        const c = { wave: '#5fe0cf', shockwave: color, tide: '#4fd6e0', quake: '#c9a46a', storm: '#e6f0a0' }[
          fx
        ];
        await this.charge(actor, [c]);
        await applyFriends();
        await this.fxShockwave(actor, foes, c, byUid);
        break;
      }
      case 'roots':
        if (foes.length === 1) {
          await this.fxProjectiles(actor, foes, color, byUid, -30, 'orb');
          this.fxRoots(foes[0]!);
        } else await this.fxShockwave(actor, foes, color, byUid);
        await applyFriends();
        break;
      case 'poison':
      case 'debuff':
        await this.charge(actor, [fx === 'poison' ? '#8be37a' : '#a37cff']);
        await applyFriends();
        for (const [n, f] of foes.entries()) {
          await this.wait(n ? 70 : 0);
          this.burst(
            f.x,
            f.y - f.top * 0.55,
            18,
            fx === 'poison' ? ['#8be37a', '#3f8a4e'] : ['#a37cff', '#4a2a7a'],
            { sp: [20, 90], life: [500, 900], size: [8, 14], g: -30, alpha: 0.7 },
          );
          void this.applyTo(f, byUid.get(f.uid) ?? [], actor);
        }
        await this.wait(300);
        break;
      case 'heal':
        await this.fxHeal(actor, friends.length ? friends : [actor], byUid);
        if (foes.length) await this.fxShockwave(actor, foes, color, byUid);
        break;
      case 'shield':
        await this.fxShield(actor, friends.length ? friends : [actor], byUid);
        break;
      default: {
        // buff и всё остальное
        const list = friends.length ? friends : [actor];
        this.castPose(actor, color, 300);
        this.ring(actor.x, actor.y, color, 60, 6, 500);
        for (const [n, f] of list.entries()) {
          await this.wait(n ? 70 : 0);
          for (let s = 0; s < 8; s++)
            this.particle(
              this.starShape(rand(3, 5), color),
              f.x + rand(-18, 18),
              f.y - rand(10, f.top),
              0,
              rand(-70, -30),
              600,
              { add: true },
            );
          void this.applyTo(f, byUid.get(f.uid) ?? [], actor);
        }
        if (foes.length) await this.fxProjectiles(actor, foes, color, byUid, 0, 'orb');
        await this.wait(350);
      }
    }
    // Шипы: урон, вернувшийся атакующему.
    const back = (byUid.get(actor.uid) ?? []).filter((ev) => ev.t === 'damage' && ev.reflect);
    if (back.length) {
      this.label(actor, tr('fx.thorns'), '#c79cff');
      await this.applyTo(actor, back, actor);
    }
    await this.wait(220);
  }

  /** Показывает на цели всё, что с ней случилось: урон, лечение, статусы. */
  private async applyTo(v: UnitView, events: BattleEvent[], from: UnitView) {
    let labelN = 0;
    for (const e of events) {
      switch (e.t) {
        case 'damage': {
          v.flash = 1;
          const dir = v.side === 'enemy' ? -1 : 1;
          v.oy += dir * 7;
          v.hit = e.crit ? 1.4 : 1;
          void this.tween((x) => (v.hit = x), v.hit, 0, e.crit ? 420 : 300, easeOut);
          void this.tween((x) => (v.oy = x), v.oy, 0, 240);
          v.hp = e.hp;
          v.shield = Math.max(0, v.shield - e.absorbed);
          const color = e.crit
            ? '#ffd84a'
            : e.affinity === 'weak'
              ? '#c9c0d4'
              : v.side === 'ally'
                ? '#ffffff'
                : '#ffffff';
          this.floatText(v, `−${fmt(e.amount)}`, color, e.crit ? 24 : 17, e.crit);
          this.burst(
            v.x + v.ox,
            v.y - v.top * 0.5,
            e.crit ? 22 : 12,
            ['#fff3c4', ELEMENT_COLOR[from.element], '#ffffff'],
            { sp: [100, e.crit ? 340 : 220], life: [220, 420], size: [3, 5] },
          );
          if (e.crit) {
            this.shake = Math.max(this.shake, 7);
            this.screenFlash('#fff3c4', 0.15);
          } else this.shake = Math.max(this.shake, 2.5);
          this.opts.onImpact?.(e.crit ? 'crit' : 'hit', from.element);
          await this.wait(60);
          break;
        }
        case 'heal':
          v.hp = e.hp;
          if (e.amount > 0) {
            this.floatText(v, `+${fmt(e.amount)}`, '#8bff9a', 17);
            for (let s = 0; s < 10; s++)
              this.particle(
                this.plusShape(rand(3, 5), '#8bff9a'),
                v.x + rand(-18, 18),
                v.y - rand(0, v.top * 0.7),
                0,
                rand(-70, -30),
                rand(600, 900),
                { add: true },
              );
            this.opts.onImpact?.('heal');
          }
          break;
        case 'shield':
          v.shield = e.amount;
          break;
        case 'status':
          if (e.landed) {
            if (!v.statuses.includes(e.status)) v.statuses.push(e.status);
            this.label(
              v,
              statusLabel(e.status),
              DEBUFFS.includes(e.status) ? '#ff9a8a' : '#ffe08a',
              labelN++,
            );
          } else this.label(v, tr('fx.resist'), '#b8b0c4', labelN++);
          break;
        case 'immune':
          this.label(v, e.what === 'stun' ? tr('fx.immuneStun') : tr('fx.immuneTm'), '#d8d0e6', labelN++);
          break;
        case 'enrage':
          this.label(v, tr('fx.enrage', { n: e.stacks }), '#ff6a4a', labelN++);
          this.ring(v.x, v.y - v.top * 0.5, '#ff5a3a', 70 * v.scale, 4, 420);
          break;
        case 'cleanse':
          v.statuses = v.statuses.filter((s) => !e.removed.includes(s));
          this.label(v, tr('fx.cleanse'), '#bff7ff', labelN++);
          break;
        case 'tm':
          if (Math.abs(e.delta) >= 50)
            this.label(
              v,
              e.delta > 0 ? tr('fx.tmUp') : tr('fx.tmDown'),
              e.delta > 0 ? '#9cc8ff' : '#c6a8ff',
              labelN++,
            );
          v.tm = e.tm;
          break;
        case 'death':
          await this.wait(120);
          this.shatter(v);
          break;
      }
    }
  }

  // ———————————————————— эффекты навыков ————————————————————

  private async fxDash(actor: UnitView, target: UnitView, color: string, byUid: Map<string, BattleEvent[]>) {
    const dx = target.x - actor.x,
      dy = target.y - actor.y;
    const d = Math.hypot(dx, dy) || 1;
    const f = Math.max(0, (d - 52) / d);
    const dir = dx >= 0 ? 1 : -1;
    await this.tween((x) => (actor.lean = x), 0, -0.18 * dir, 120, easeOut);
    for (let i = 0; i < 4; i++) setTimeoutGame(this, 30 * i, () => this.ghost(actor, color));
    void this.tween((x) => (actor.lean = x), -0.18 * dir, 0.12 * dir, 170, easeIn);
    setTimeoutGame(this, 120, () => this.swoosh(actor, color));
    await Promise.all([
      this.tween((x) => (actor.ox = x), 0, dx * f, 170, easeIn),
      this.tween((x) => (actor.oy = x), 0, dy * f, 170, easeIn),
    ]);
    this.slash(target.x, target.y - target.top * 0.5, color);
    this.ring(target.x, target.y, color, 50, 5, 450);
    await this.applyTo(target, byUid.get(target.uid) ?? [], actor);
    await this.wait(140);
    await Promise.all([
      this.tween((x) => (actor.ox = x), actor.ox, 0, 240, easeInOut),
      this.tween((x) => (actor.oy = x), actor.oy, 0, 240, easeInOut),
    ]);
  }

  private async fxProjectiles(
    actor: UnitView,
    foes: UnitView[],
    color: string,
    byUid: Map<string, BattleEvent[]>,
    arc: number,
    kind: 'arrow' | 'orb',
  ) {
    void this.tween((x) => (actor.pulse = x), 1, 1.07, 200);
    // Прицелиться: рука с луком/посохом вытягивается вперёд, после выстрела — отдача.
    void this.tween((x) => (actor.aim = x), 0, 1, 200, easeOut);
    setTimeoutGame(this, 220, () => {
      void this.tween((x) => (actor.aim = x), 1, 0.5, 90, easeOut).then(() =>
        setTimeoutGame(this, 200, () => void this.tween((x) => (actor.aim = x), 0.5, 0, 260, easeInOut)),
      );
      const h = this.handPos(actor);
      this.glow(h.x, h.y, color, 22, 260, 0, 0, { grow: 30 });
      void this.tween((x) => (actor.pulse = x), 1.07, 1, 160);
      const back = actor.side === 'ally' ? 6 : -6;
      void this.tween((x) => (actor.oy = x), 0, back, 80, easeOut).then(() =>
        this.tween((x) => (actor.oy = x), back, 0, 220, easeOut),
      );
    });
    const from = actor.hand ? null : { x: actor.x, y: actor.y - actor.top * 0.6 };
    await Promise.all(
      foes.map(async (f, n) => {
        await this.wait(200 + n * 100);
        const s = from ?? this.handPos(actor);
        await this.projectile(s.x, s.y, f.x, f.y - f.top * 0.5, 330, arc, kind, color);
        this.burst(f.x, f.y - f.top * 0.5, 14, [color, '#ffffff'], {
          sp: [80, 220],
          life: [200, 400],
          size: [3, 5],
        });
        await this.applyTo(f, byUid.get(f.uid) ?? [], actor);
      }),
    );
  }

  /** Где сейчас рука/оружие персонажа на экране (с учётом позы). Без рига — над центром. */
  private handPos(v: UnitView): { x: number; y: number } {
    if (!v.hand) return { x: v.x + v.ox, y: v.y + v.oy - v.top * 0.6 };
    let [hx, hy] = v.hand;
    const w = v.rig?.find((r) => r.part.role === 'weapon');
    if (w) {
      const a = -v.lean * 2.4 - v.cast * 1.05 - v.aim * 0.55;
      const [px, py] = w.part.pivot;
      const dx = hx - px,
        dy = hy - py;
      hx = px + dx * Math.cos(a) - dy * Math.sin(a);
      hy = py + dx * Math.sin(a) + dy * Math.cos(a);
    }
    return { x: v.x + v.ox + hx * v.scale, y: v.y + v.oy + hy * v.scale };
  }

  /** Поза заклинания: рука с оружием/посохом поднимается, у руки вспыхивает свет, под ногами — круг. */
  private castPose(actor: UnitView, color: string, hold = 340) {
    void this.tween((x) => (actor.cast = x), actor.cast, 1, 220, easeOut).then(() =>
      setTimeoutGame(this, hold, () => void this.tween((x) => (actor.cast = x), 1, 0, 260, easeInOut)),
    );
    setTimeoutGame(this, 160, () => {
      const h = this.handPos(actor);
      this.glow(h.x, h.y, color, 26, 420, 0, 0, { grow: 40 });
      this.glow(h.x, h.y, '#ffffff', 10, 300, 0, 0);
    });
    this.fx(
      hold + 420,
      (g, k) => {
        const a = Math.sin(k * Math.PI);
        const rx = 30 * actor.scale * (0.8 + 0.4 * k),
          ry = 9 * actor.scale * (0.8 + 0.4 * k);
        g.ellipse(actor.x, actor.y, rx, ry).stroke({ width: 2.5, color, alpha: 0.8 * a });
        g.ellipse(actor.x, actor.y, rx * 0.7, ry * 0.7).stroke({
          width: 1.5,
          color: '#ffffff',
          alpha: 0.5 * a,
        });
        for (let i = 0; i < 6; i++) {
          const t = k * 2 + (i * Math.PI) / 3;
          g.circle(actor.x + Math.cos(t) * rx, actor.y + Math.sin(t) * ry, 2).fill({ color, alpha: a });
        }
      },
      true,
    );
  }

  /** След от взмаха оружием перед бойцом. */
  private swoosh(actor: UnitView, color: string) {
    const cx = actor.x + actor.ox,
      cy = actor.y + actor.oy - actor.top * 0.55;
    const R = 46 * actor.scale;
    const dir = actor.side === 'ally' ? -1 : 1;
    this.fx(260, (g, k) => {
      const a0 = -2.2 + k * 1.6,
        a1 = a0 + 1.6;
      const al = 1 - k;
      for (let j = 0; j < 4; j++)
        g.moveTo(cx + Math.cos(a0) * (R - j * 4), cy + dir * Math.sin(a0) * (R - j * 4) * 0.8)
          .arc(cx, cy, R - j * 4, a0, a1)
          .stroke({ width: 5 - j, color: j ? color : '#ffffff', alpha: al * (0.9 - j * 0.18) });
    });
  }

  private async charge(actor: UnitView, colors: string[]) {
    this.castPose(actor, colors[0]!);
    void this.tween((x) => (actor.pulse = x), 1, 1.1, 330);
    void this.tween((x) => (actor.oy = x), actor.oy, -10, 300, easeOut).then(() =>
      this.tween((x) => (actor.oy = x), -10, 0, 260, easeInOut),
    );
    actor.flashSprite.tint = colors[0]!;
    actor.flash = 0.7;
    setTimeoutGame(this, 420, () => (actor.flashSprite.tint = 0xffffff));
    for (let i = 0; i < 10; i++) {
      setTimeoutGame(this, i * 30, () => {
        const a = Math.random() * Math.PI * 2;
        const h = this.handPos(actor);
        const cx = h.x,
          cy = h.y;
        this.glow(
          cx + Math.cos(a) * 48,
          cy + Math.sin(a) * 48,
          colors[i % colors.length]!,
          rand(5, 9),
          330,
          -Math.cos(a) * 140,
          -Math.sin(a) * 140,
        );
      });
    }
    await this.wait(340);
    void this.tween((x) => (actor.pulse = x), 1.1, 1, 200);
  }

  private async fxShockwave(
    actor: UnitView,
    foes: UnitView[],
    color: string,
    byUid: Map<string, BattleEvent[]>,
  ) {
    const cx = actor.x,
      cy = actor.y;
    const R = 520;
    this.shake = Math.max(this.shake, 7);
    this.fx(
      760,
      (g, k) => {
        const r = Math.max(0.1, R * easeOut(k));
        g.ellipse(cx, cy, r, r * 0.6).stroke({ width: 16 * (1 - k) + 2, color, alpha: (1 - k) * 0.85 });
        g.ellipse(cx, cy, r, r * 0.6).stroke({ width: 2, color: '#ffffff', alpha: (1 - k) * 0.5 });
      },
      true,
    );
    await Promise.all(
      foes.map(async (f) => {
        const d = Math.min(0.98, Math.hypot(f.x - cx, (f.y - cy) / 0.6) / R);
        await this.wait((1 - Math.cbrt(1 - d)) * 760);
        await this.applyTo(f, byUid.get(f.uid) ?? [], actor);
      }),
    );
  }

  private async fxFirePillars(foes: UnitView[], byUid: Map<string, BattleEvent[]>) {
    this.screenFlash('#ff7a2a', 0.22);
    this.shake = Math.max(this.shake, 9);
    this.fx(
      720,
      (g, k) => {
        const r = Math.max(0.1, 210 * easeOut(k));
        g.ellipse(180, 215, r, r * 0.42).stroke({ width: 22 * (1 - k) + 2, color: '#ff7a2a', alpha: 1 - k });
      },
      true,
    );
    await Promise.all(
      foes.map(async (f, n) => {
        await this.wait(n * 60);
        for (let j = 0; j < 16; j++)
          setTimeoutGame(this, j * 24, () => {
            for (let m = 0; m < 2; m++)
              this.glow(
                f.x + rand(-16, 16) * f.scale,
                f.y - rand(0, 10),
                pick(['#ff7a2a', '#ffb347', '#ff4a2a', '#ffd36b']),
                rand(10, 17),
                rand(380, 600),
                rand(-15, 15),
                rand(-280, -150),
                { grow: -16 },
              );
          });
        this.ring(f.x, f.y, '#ff8a3d', 44, 6, 450);
        await this.wait(200);
        await this.applyTo(f, byUid.get(f.uid) ?? [], f);
      }),
    );
  }

  private async fxLightPillars(foes: UnitView[], byUid: Map<string, BattleEvent[]>) {
    this.screenFlash('#fff3c4', 0.35);
    this.shake = Math.max(this.shake, 8);
    await Promise.all(
      foes.map(async (f, n) => {
        await this.wait(n * 90);
        const tx = f.x,
          ty = f.y,
          s = f.scale;
        this.fx(700, (g, k) => {
          const w = (k < 0.2 ? easeOut(k / 0.2) : 1 - (k - 0.2) / 0.8) * 26 * s;
          if (w <= 0) return;
          g.rect(tx - w, 0, w * 2, ty).fill({ color: '#f0c860', alpha: 0.35 });
          g.rect(tx - w * 0.45, 0, w * 0.9, ty).fill({ color: '#fffbe8', alpha: 0.75 });
        });
        this.ring(tx, ty, '#f0c860', 56, 7, 500);
        for (let i = 0; i < 12; i++)
          this.particle(
            this.starShape(rand(3, 5), '#fff0b8'),
            tx + rand(-14, 14),
            ty - rand(20, 80),
            rand(-30, 30),
            rand(30, 90),
            rand(500, 900),
            { add: true, g: 80 },
          );
        await this.wait(160);
        await this.applyTo(f, byUid.get(f.uid) ?? [], f);
      }),
    );
  }

  private async fxMeteors(foes: UnitView[], byUid: Map<string, BattleEvent[]>) {
    await Promise.all(
      foes.map(async (f, n) => {
        await this.wait(n * 110);
        await this.projectile(f.x + rand(-90, 90), -30, f.x, f.y - 18, 420, 0, 'meteor', '#ff7a2a');
        this.burst(f.x, f.y - 14, 24, ['#ff7a2a', '#ffb347', '#ffd36b'], {
          sp: [120, 320],
          life: [300, 600],
          size: [5, 10],
          glow: true,
          g: 200,
        });
        this.ring(f.x, f.y, '#ff8a3d', 50, 7, 450);
        this.shake = Math.max(this.shake, 6);
        await this.applyTo(f, byUid.get(f.uid) ?? [], f);
      }),
    );
  }

  private fxRoots(f: UnitView) {
    const x = f.x,
      y = f.y;
    this.fx(700, (g, k) => {
      const h = 50 * easeOut(Math.min(1, k * 2)) * (1 - Math.max(0, k - 0.6) / 0.4);
      for (let n = 0; n < 4; n++) {
        const ox = (n - 1.5) * 12;
        g.moveTo(x + ox, y + 2);
        for (let s = 1; s <= 5; s++) g.lineTo(x + ox + Math.sin(s * 1.3 + n) * 6, y + 2 - (h * s) / 5);
      }
      g.stroke({ width: 5, color: '#2e6b3c', alpha: 0.9 });
    });
  }

  private async fxHeal(actor: UnitView, targets: UnitView[], byUid: Map<string, BattleEvent[]>) {
    this.castPose(actor, '#8bff9a', 420);
    await this.wait(160);
    const { x: ox, y: oy } = this.handPos(actor);
    this.fx(500, (g, k) => {
      g.circle(ox, oy, 10 + 26 * Math.sin(k * Math.PI)).fill({ color: '#5fe0cf', alpha: 0.25 });
    });
    await this.wait(320);
    await Promise.all(
      targets.map(async (t, n) => {
        await this.wait(n * 90);
        await this.projectile(ox, oy, t.x, t.y - t.top * 0.4, 520, 0, 'orb', '#5fe0cf', {
          x: (ox + t.x) / 2 + rand(-90, 90),
          y: Math.min(oy, t.y) - rand(60, 120),
        });
        this.ring(t.x, t.y, '#8bff9a', 40, 5, 450);
        await this.applyTo(t, byUid.get(t.uid) ?? [], actor);
      }),
    );
  }

  private async fxShield(actor: UnitView, targets: UnitView[], byUid: Map<string, BattleEvent[]>) {
    this.castPose(actor, '#7fe7ff', 260);
    void this.tween((x) => (actor.oy = x), 0, -14, 180);
    await this.wait(180);
    await this.tween((x) => (actor.oy = x), -14, 0, 110, easeIn);
    this.shake = Math.max(this.shake, 5);
    this.ring(actor.x, actor.y, '#7fe7ff', 80, 8, 600);
    const ax = actor.x,
      ay = actor.y;
    this.fx(
      1100,
      (g, k) => {
        const al = k < 0.15 ? k / 0.15 : k > 0.75 ? (1 - k) / 0.25 : 1;
        g.ellipse(ax, ay, 52, 18).stroke({ width: 3, color: '#7fe7ff', alpha: 0.8 * al });
        g.ellipse(ax, ay, 40, 14).stroke({ width: 1.6, color: '#7fe7ff', alpha: 0.8 * al });
        for (let n = 0; n < 8; n++) {
          const a = n * (Math.PI / 4) + this.time / 400;
          const px = ax + Math.cos(a) * 46,
            py = ay + Math.sin(a) * 16;
          g.moveTo(px - 3, py).lineTo(px + 3, py);
        }
        g.stroke({ width: 2, color: '#bff7ff', alpha: al });
      },
      true,
    );
    await Promise.all(
      targets.map(async (t, n) => {
        await this.wait(120 + n * 80);
        this.dome(t);
        await this.applyTo(t, byUid.get(t.uid) ?? [], actor);
      }),
    );
  }

  private dome(t: UnitView) {
    const w = 30 * t.scale + 8,
      h = t.top * 1.02,
      cx = t.x,
      cy = t.y - h * 0.46;
    this.fx(900, (g, k) => {
      const app = easeBack(Math.min(1, k * 3.5));
      const al = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      const rx = Math.max(0.1, w * app),
        ry = Math.max(0.1, h * 0.58 * app);
      g.ellipse(cx, cy, rx, ry)
        .fill({ color: '#7fe7ff', alpha: 0.12 * al })
        .stroke({ width: 2.5, color: '#7fe7ff', alpha: 0.9 * al });
    });
    for (let i = 0; i < 8; i++)
      this.particle(
        this.starShape(rand(3, 5), '#bff7ff'),
        cx + rand(-w, w),
        cy + rand(-h * 0.4, h * 0.4),
        0,
        -30,
        500,
        { add: true },
      );
  }

  // ———————————————————— примитивы ————————————————————

  private fx(dur: number, draw: (g: Graphics, k: number) => void, under = false) {
    const g = new Graphics();
    g.blendMode = 'add';
    (under ? this.layerFxUnder : this.layerFx).addChild(g);
    this.fxs.push({ start: this.time, dur, g, draw });
  }

  private ring(x: number, y: number, color: string, r: number, w: number, dur: number) {
    this.fx(
      dur,
      (g, k) => {
        const rr = Math.max(0.1, r * easeOut(k) + 4);
        g.ellipse(x, y, rr, rr * 0.34).stroke({ width: w * (1 - k) + 1, color, alpha: (1 - k) * 0.95 });
      },
      true,
    );
  }

  private slash(x: number, y: number, color: string) {
    this.fx(340, (g, k) => {
      const a0 = -2.7,
        sw = 2.5 * easeOut(Math.min(1, k * 1.8)),
        al = 1 - easeOut(k),
        R = 38;
      const pts: number[] = [];
      for (let i = 0; i <= 16; i++) {
        const a = a0 + (sw * i) / 16;
        pts.push(x + Math.cos(a - 0.3) * R, y + Math.sin(a - 0.3) * R);
      }
      for (let i = 16; i >= 0; i--) {
        const a = a0 + (sw * i) / 16;
        pts.push(x - 6 + Math.cos(a - 0.3) * (R - 12), y + 7 + Math.sin(a - 0.3) * (R - 12));
      }
      if (pts.length >= 6) g.poly(pts).fill({ color, alpha: al * 0.9 });
    });
    this.glow(x, y, color, 34, 240, 0, 0, { grow: -60 });
  }

  private ghost(v: UnitView, color: string) {
    const s = new Sprite(v.sprite.texture);
    s.anchor.copyFrom(v.sprite.anchor);
    s.scale.copyFrom(v.sprite.scale);
    s.tint = color;
    s.blendMode = 'add';
    s.position.set(v.x + v.ox, v.y + v.oy);
    s.alpha = 0.55;
    this.layerFxUnder.addChild(s);
    this.parts.push({
      d: s,
      vx: 0,
      vy: 0,
      g: 0,
      drag: 0,
      life: 260,
      max: 260,
      grow: 0,
      spin: 0,
      baseScale: s.scale.x,
      fade: true,
    });
  }

  private projectile(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    dur: number,
    arc: number,
    kind: 'arrow' | 'orb' | 'meteor',
    color: string,
    ctrl?: { x: number; y: number },
  ): Promise<void> {
    const c = new Container();
    const glow = new Sprite(glowTexture(color));
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.width = glow.height = kind === 'meteor' ? 44 : 28;
    c.addChild(glow);
    if (kind === 'arrow') {
      const a = new Graphics()
        .moveTo(-16, 0)
        .lineTo(2, 0)
        .stroke({ width: 4, color: LEAD })
        .moveTo(-16, 0)
        .lineTo(2, 0)
        .stroke({ width: 2, color: '#c99a5a' })
        .poly([7, 0, 0, -3.5, 0, 3.5])
        .fill(color)
        .stroke({ width: 1.2, color: LEAD });
      c.addChild(a);
    } else if (kind === 'meteor') {
      c.addChild(new Graphics().circle(0, 0, 5).fill('#2a1410').stroke({ width: 1.5, color: LEAD }));
    } else {
      const core = new Sprite(glowTexture('#ffffff'));
      core.anchor.set(0.5);
      core.blendMode = 'add';
      core.width = core.height = 10;
      c.addChild(core);
    }
    this.layerFx.addChild(c);
    const pos = (k: number): [number, number] => {
      if (ctrl) {
        const m = 1 - k;
        return [m * m * x0 + 2 * m * k * ctrl.x + k * k * x1, m * m * y0 + 2 * m * k * ctrl.y + k * k * y1];
      }
      return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k + arc * Math.sin(Math.PI * k)];
    };
    return this.tween(
      (k) => {
        const [x, y] = pos(k);
        const [px, py] = pos(Math.max(0, k - 0.03));
        c.position.set(x, y);
        c.rotation = Math.atan2(y - py, x - px);
        this.glow(
          x,
          y,
          kind === 'meteor' ? pick(['#ff7a2a', '#ffb347']) : color,
          kind === 'meteor' ? rand(6, 10) : 4,
          kind === 'meteor' ? 380 : 260,
          rand(-10, 10),
          kind === 'meteor' ? rand(-40, -10) : 0,
          { grow: -8 },
        );
      },
      0,
      1,
      dur,
      (k) => k,
    ).then(() => {
      c.destroy({ children: true });
    });
  }

  private glow(
    x: number,
    y: number,
    color: string,
    size: number,
    life: number,
    vx = 0,
    vy = 0,
    o: { grow?: number; g?: number; alpha?: number } = {},
  ) {
    if (this.parts.length > 700) return;
    const s = new Sprite(glowTexture(color));
    s.anchor.set(0.5);
    s.blendMode = 'add';
    s.width = s.height = size * 2;
    s.position.set(x, y);
    s.alpha = o.alpha ?? 1;
    this.layerFx.addChild(s);
    this.parts.push({
      d: s,
      vx,
      vy,
      g: o.g ?? 0,
      drag: 1.5,
      life,
      max: life,
      grow: o.grow ?? 0,
      spin: 0,
      baseScale: s.scale.x,
      fade: true,
    });
  }

  private particle(
    d: Container,
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    o: { add?: boolean; g?: number; spin?: number } = {},
  ) {
    if (this.parts.length > 700) {
      d.destroy();
      return;
    }
    d.position.set(x, y);
    if (o.add && 'blendMode' in d) (d as Graphics).blendMode = 'add';
    this.layerFx.addChild(d);
    this.parts.push({
      d,
      vx,
      vy,
      g: o.g ?? 0,
      drag: 1,
      life,
      max: life,
      grow: 0,
      spin: o.spin ?? 0,
      baseScale: 1,
      fade: true,
    });
  }

  private burst(
    x: number,
    y: number,
    n: number,
    colors: string[],
    o: {
      sp: [number, number];
      life: [number, number];
      size: [number, number];
      g?: number;
      glow?: boolean;
      alpha?: number;
    },
  ) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = rand(o.sp[0], o.sp[1]);
      this.glow(
        x,
        y,
        pick(colors),
        rand(o.size[0], o.size[1]),
        rand(o.life[0], o.life[1]),
        Math.cos(a) * sp,
        Math.sin(a) * sp,
        { g: o.g, alpha: o.alpha },
      );
    }
  }

  private starShape(r: number, color: string) {
    const pts: number[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5 - Math.PI / 2,
        rr = i % 2 ? r * 0.45 : r;
      pts.push(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    return new Graphics().poly(pts).fill(color);
  }

  private plusShape(r: number, color: string) {
    return new Graphics()
      .rect(-r, -r * 0.3, r * 2, r * 0.6)
      .fill(color)
      .rect(-r * 0.3, -r, r * 0.6, r * 2)
      .fill(color);
  }

  private shatter(v: UnitView) {
    if (!v.alive) return;
    v.alive = false;
    v.statuses = [];
    v.shield = 0;
    v.flash = 1;
    if (v.rig) {
      // «Живой» персонаж распадается на части: каждая отлетает по-своему и гаснет.
      for (const r of v.rig) r.fall = { vx: rand(-40, 40), vy: rand(-50, -10), vr: rand(-1.6, 1.6) };
      void this.tween((x) => (v.dying = x), 0, 1, 850, easeOut).then(() => (v.alpha = 0));
    } else setTimeoutGame(this, 60, () => void this.tween((x) => (v.alpha = x), 1, 0, 90, easeIn));
    const colors = [ELEMENT_COLOR[v.element], '#3b2d55', '#cfc8e2', '#2c2440', '#ffffff'];
    for (let i = 0; i < (v.rig ? 14 : 30); i++) {
      const r = rand(4, 10);
      const g = new Graphics()
        .poly([rand(-r, r), rand(-r, r), rand(-r, r), rand(-r, r), rand(-r, r), rand(-r, r)])
        .fill(pick(colors))
        .stroke({ width: 1.5, color: LEAD });
      g.rotation = rand(0, 6);
      this.particle(
        g,
        v.x + rand(-20, 20) * v.scale,
        v.y - rand(4, v.top * 0.9),
        rand(-150, 150),
        rand(-260, -40),
        rand(800, 1200),
        { g: 620, spin: rand(-9, 9) },
      );
    }
    for (let i = 0; i < 12; i++)
      this.particle(
        this.starShape(rand(3, 6), '#ffffff'),
        v.x + rand(-16, 16),
        v.y - rand(10, v.top * 0.8),
        rand(-60, 60),
        rand(-90, -20),
        rand(400, 800),
        { add: true },
      );
    this.ring(v.x, v.y, this.sceneTint(), 60, 6, 500);
    this.shake = Math.max(this.shake, 5);
    this.opts.onImpact?.('death');
  }

  private floatText(v: UnitView, s: string, color: string, size: number, crit = false) {
    const c = new Container();
    if (crit) {
      const t = new Text({
        text: tr('battle.crit'),
        style: {
          fontFamily: FONT,
          fontWeight: '700',
          fontSize: 11,
          fill: '#ff9a4a',
          stroke: { color: LEAD, width: 3, join: 'round' },
        },
      });
      t.anchor.set(0.5);
      t.y = -size * 0.85;
      c.addChild(t);
    }
    const t = new Text({
      text: s,
      style: {
        fontFamily: FONT,
        fontWeight: '700',
        fontSize: size,
        fill: color,
        stroke: { color: LEAD, width: crit ? 5 : 4, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    c.addChild(t);
    const x = v.x + rand(-6, 6),
      y = v.y - v.top - 30;
    c.position.set(x, y);
    this.layerUi.addChild(c);
    void this.tween(
      (k) => {
        const pop = k < 0.12 ? 0.5 + easeBack(k / 0.12) * 0.7 : 1.2 - Math.min(0.2, (k - 0.12) * 0.8);
        c.scale.set(pop);
        c.y = y - easeOut(k) * 26;
        c.alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      },
      0,
      1,
      1050,
      (k) => k,
    ).then(() => c.destroy({ children: true }));
  }

  private label(v: UnitView, s: string, color: string, n = 0) {
    const t = new Text({
      text: s,
      style: {
        fontFamily: FONT,
        fontWeight: '700',
        fontSize: 11,
        fill: color,
        stroke: { color: LEAD, width: 3, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    const y = v.y - v.top * 0.35 + n * 13;
    t.position.set(v.x, y);
    this.layerUi.addChild(t);
    void this.tween(
      (k) => {
        t.y = y - easeOut(k) * 16;
        t.alpha = k > 0.7 ? (1 - k) / 0.3 : Math.min(1, k * 6);
      },
      0,
      1,
      1000,
      (k) => k,
    ).then(() => t.destroy());
  }

  banner(text: string, color: string) {
    const c = new Container();
    const by = 312;
    const g = new Graphics();
    const t = new Text({
      text,
      style: {
        fontFamily: FONT,
        fontWeight: '700',
        fontSize: 20,
        fill: color,
        stroke: { color: LEAD, width: 4, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    t.position.set(FIELD.width / 2, by + 1);
    c.addChild(g, t);
    this.layerUi.addChild(c);
    const halfW = Math.max(90, t.width / 2 + 30);
    void this.tween(
      (k) => {
        const inK = easeOut(Math.min(1, k / 0.14));
        const out = k > 0.78 ? (k - 0.78) / 0.22 : 0;
        const w = halfW * inK;
        g.clear()
          .poly([
            FIELD.width / 2 - w - 14,
            by,
            FIELD.width / 2 - w,
            by - 17,
            FIELD.width / 2 + w,
            by - 17,
            FIELD.width / 2 + w + 14,
            by,
            FIELD.width / 2 + w,
            by + 17,
            FIELD.width / 2 - w,
            by + 17,
          ])
          .fill({ color: 0x100b16, alpha: 0.88 })
          .stroke({ width: 2, color });
        t.alpha = inK > 0.6 ? 1 : 0;
        c.alpha = 1 - out;
      },
      0,
      1,
      1300,
      (k) => k,
    ).then(() => c.destroy({ children: true }));
  }

  private screenFlash(color: string, a: number) {
    this.flashColor = color;
    this.flashA = Math.max(this.flashA, a);
  }

  // ———————————————————— кадр ————————————————————

  private update(realDt: number) {
    if (this.destroyed) return;
    const dt = Math.min(50, realDt) * this.speed;
    this.time += dt;
    const due = this.timers.filter((t) => this.time >= t.at);
    this.timers = this.timers.filter((t) => this.time < t.at);
    for (const t of due) t.res();
    this.tweens = this.tweens.filter((tw) => {
      const k = Math.min(1, (this.time - tw.start) / tw.dur);
      tw.set(tw.from + (tw.to - tw.from) * tw.ease(k));
      if (k >= 1) tw.done();
      return k < 1;
    });
    const s = dt / 1000;
    this.parts = this.parts.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        p.d.destroy();
        return false;
      }
      p.vx *= Math.max(0, 1 - p.drag * s);
      p.vy *= Math.max(0, 1 - p.drag * s);
      p.vy += p.g * s;
      p.d.x += p.vx * s;
      p.d.y += p.vy * s;
      p.d.rotation += p.spin * s;
      if (p.grow) {
        const sc = Math.max(0.02, p.d.scale.x + (p.grow * s) / 64);
        p.d.scale.set(sc);
      }
      const k = p.life / p.max;
      if (p.fade) p.d.alpha = Math.min(p.d.alpha, k < 0.4 ? k / 0.4 : 1);
      return true;
    });
    this.fxs = this.fxs.filter((f) => {
      const k = (this.time - f.start) / f.dur;
      if (k >= 1) {
        f.g.destroy();
        return false;
      }
      f.g.clear();
      f.draw(f.g, Math.max(0, k));
      return true;
    });
    // Атмосферные частицы главы.
    this.amb += dt;
    const iv = this.opts.scene === 'forge' ? 90 : 180;
    while (this.amb > iv) {
      this.amb -= iv;
      if (this.opts.scene === 'forge')
        this.glow(
          rand(0, FIELD.width),
          FIELD.height + 4,
          pick(['#ff8a3d', '#ffb347']),
          rand(2, 3.5),
          4200,
          rand(-14, 14),
          rand(-70, -30),
          { alpha: 0.8 },
        );
      else if (this.opts.scene === 'cathedral')
        this.glow(
          rand(60, 300),
          rand(150, FIELD.height),
          '#bff7ff',
          rand(2, 4),
          3200,
          rand(-4, 4),
          rand(-14, -4),
          { alpha: 0.35 },
        );
      else
        this.glow(
          rand(0, FIELD.width),
          rand(120, 320),
          '#a37cff',
          rand(3, 6),
          3200,
          rand(-6, 6),
          rand(-16, -6),
          { alpha: 0.35 },
        );
    }

    for (const v of this.views.values()) this.drawUnit(v, dt);
    this.shake = Math.max(0, this.shake - dt * 0.03);
    const sx = this.shake ? (Math.random() - 0.5) * this.shake : 0,
      sy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    this.layout();
    this.world.x += sx * this.world.scale.x;
    this.world.y += sy * this.world.scale.y;
    this.flashA = Math.max(0, this.flashA - dt * 0.0011);
    this.flashG.clear();
    if (this.flashA > 0.005)
      this.flashG
        .rect(0, 0, this.app.screen.width, this.app.screen.height)
        .fill({ color: this.flashColor, alpha: this.flashA });
  }

  /** Анимация слоёв: дыхание торса, покачивание волос и плащей, моргание, свечение, замах оружием. */
  private drawRig(v: UnitView, t: number) {
    const alive = v.alive ? 1 : 0;
    const torso = v.rig!.find((r) => r.part.motion?.kind === 'breathe');
    const breath = torso && alive ? rigValue(torso.part.motion!, t) : 0;
    const tpy = torso?.part.pivot[1] ?? 0;
    // Отшатнуться от удара: торс сжимается, голова откидывается, всё чуть уходит назад.
    const recoil = v.hit;
    for (const r of v.rig!) {
      const m = r.part.motion;
      const role = r.part.role;
      const px = r.part.pivot[0];
      const py = r.part.pivot[1];
      let y = py * v.scale;
      if (r.part.follow) y += breath * (tpy - py) * v.scale;
      if (r.part.follow) y += recoil * 0.06 * (tpy - py) * v.scale;
      r.holder.x = px * v.scale;
      r.holder.y = y;
      let rotation = 0;
      let alpha = 1;
      const val = m && alive ? rigValue(m, t) : 0;
      if (m)
        switch (m.kind) {
          case 'sway':
            rotation = (val * Math.PI) / 180;
            break;
          case 'swing':
            rotation = (val * Math.PI) / 180;
            break;
          case 'breathe':
            r.holder.scale.y = 1 + val - recoil * 0.07;
            r.holder.scale.x = 1 + recoil * 0.04;
            break;
          case 'bob':
            r.holder.y += val * v.scale;
            break;
          case 'pulse':
            alpha = alive ? val : 0;
            break;
          case 'blink':
            alpha = recoil > 0.3 ? 1 : val; // от удара — зажмуриться
            break;
        }
      if (role === 'weapon') {
        // Замах следует за наклоном тела и уходит дальше; каст поднимает руку, прицел — вытягивает вперёд.
        rotation += -v.lean * 2.4 - v.cast * 1.05 - v.aim * 0.55 + recoil * 0.25;
      } else if (role === 'head') {
        rotation += -v.cast * 0.12 - recoil * 0.22;
      } else if (role === 'fx' && v.cast > 0) {
        alpha = Math.min(1, alpha + v.cast);
        r.holder.scale.set(1 + v.cast * 0.35);
      } else if (m?.kind === 'sway') {
        rotation += recoil * 0.12; // плащи и волосы взлетают от удара
      }
      if (v.dying > 0 && r.fall) {
        const k = v.dying;
        r.holder.x += r.fall.vx * k * v.scale;
        r.holder.y += (r.fall.vy * k + 70 * k * k) * v.scale;
        rotation += r.fall.vr * k;
        alpha *= 1 - k * k;
      }
      r.holder.rotation = rotation;
      r.holder.alpha = alpha;
    }
  }

  private drawUnit(v: UnitView, dt: number) {
    const body = v.root.children[3] as Container;
    const t = this.time + v.phase * 400;
    const bx = v.ox;
    let by = v.oy,
      sx = v.pulse,
      sy = v.pulse,
      rot = v.lean;
    if (v.rig) this.drawRig(v, t);
    else if (v.alive) {
      switch (v.idle) {
        case 'float':
          by += Math.sin(t / 520) * 4 - 4;
          rot += Math.sin(t / 900) * 0.03;
          break;
        case 'sway':
          rot += Math.sin(t / 850) * 0.045;
          sy *= 1 + Math.sin(t / 420) * 0.012;
          break;
        case 'heavy': {
          const b = Math.sin(t / 700) * 0.03;
          sy *= 1 + b;
          sx *= 1 - b * 0.4;
          break;
        }
        default:
          sy *= 1 + Math.sin(t / 420) * 0.022;
      }
    }
    body.position.set(bx, by);
    body.scale.set(sx, sy);
    body.rotation = rot;
    // Аура ранга: элита — серебро, чемпион — золото с искрами.
    v.aura.clear();
    if (v.alive && v.tier !== 'normal') {
      const gold = v.tier === 'champion';
      const k = 0.55 + 0.25 * Math.sin(this.time / 300 + v.phase);
      v.aura
        .ellipse(v.ox, v.oy - 2, 32 * v.scale, 11 * v.scale)
        .fill({ color: gold ? '#f0c860' : '#c7d0e0', alpha: 0.4 * k })
        .stroke({ width: 2.5, color: gold ? '#ffd36b' : '#ffffff', alpha: 0.7 * k });
      v.aura
        .ellipse(v.ox, v.oy - v.top * 0.45, 28 * v.scale, v.top * 0.58)
        .stroke({ width: 3, color: gold ? '#ffd36b' : '#dfe5ef', alpha: 0.35 * k });
      if (gold && Math.random() < dt * 0.006)
        this.glow(v.x + rand(-20, 20) * v.scale, v.y - rand(0, v.top), '#ffd36b', rand(3, 5), 700, 0, -30, {
          alpha: 0.8,
        });
    }
    v.root.alpha = v.alpha;
    if (v.flash > 0) v.flash = Math.max(0, v.flash - dt / 280);
    v.flashSprite.alpha = v.flash;
    v.hpShown += (v.hp - v.hpShown) * Math.min(1, dt * 0.014);
    if (v.hpTrail > v.hpShown) v.hpTrail = Math.max(v.hpShown, v.hpTrail - v.maxHp * dt * 0.0004);
    else v.hpTrail = v.hpShown;
    // Кольца: ход и цели.
    v.ring.clear();
    const rs = v.scale * (v.boss ? 1.55 : 1);
    if (v.active && v.alive)
      v.ring
        .ellipse(0, 0, 26 * rs, 8 * v.scale)
        .stroke({ width: 2.5, color: '#f0c860', alpha: 0.7 + 0.3 * Math.sin(this.time / 160) });
    if (v.targetable && v.alive) {
      const a = 0.6 + 0.4 * Math.sin(this.time / 140);
      const rx = 28 * rs,
        ry = 8.5 * v.scale;
      const off = this.time / 600;
      for (let i = 0; i < 14; i++) {
        const a0 = off + (i / 14) * Math.PI * 2;
        const a1 = a0 + ((Math.PI * 2) / 14) * 0.6;
        v.ring.moveTo(Math.cos(a0) * rx, Math.sin(a0) * ry).lineTo(Math.cos(a1) * rx, Math.sin(a1) * ry);
      }
      v.ring.stroke({ width: 2.5, color: '#ff5a6a', alpha: a });
    }
    // Полоски HP и шкалы хода.
    const bw = v.boss ? 62 : 44;
    const x = v.x + v.ox - bw / 2,
      y = v.y + v.oy - v.top - 14;
    const g = v.bars;
    g.clear();
    g.alpha = v.alpha;
    v.icons.alpha = v.alpha;
    if (v.alpha < 0.02) {
      v.icons.removeChildren().forEach((c) => c.destroy());
      return;
    }
    const f = (n: number) => Math.max(0, Math.min(1, n / v.maxHp));
    g.rect(x - 1.5, y - 1.5, bw + 3, 12).fill(LEAD);
    g.rect(x, y, bw * f(v.hpTrail), 6).fill({ color: '#ffffff', alpha: 0.75 });
    g.rect(x, y, bw * f(v.hpShown), 6).fill(v.side === 'ally' ? '#5fcf6f' : '#e2474f');
    g.rect(x, y, bw * f(v.hpShown), 1.5).fill({ color: '#ffffff', alpha: 0.25 });
    if (v.shield > 0) g.rect(x - 1, y - 1, bw + 2, 8).stroke({ width: 1.5, color: '#7fe7ff' });
    const tm = Math.max(0, Math.min(1, v.tm / 1000));
    g.rect(x, y + 7, bw * tm, 2.2).fill(tm >= 0.999 ? '#f0c860' : '#6fb3ff');
    // Иконки статусов (уникальные, до 4).
    const uniq = [...new Set(v.statuses)].slice(0, 4);
    if (
      v.icons.children.length !== uniq.length ||
      uniq.some((s, i) => (v.icons.children[i] as Sprite & { sid?: string })?.sid !== s)
    ) {
      v.icons.removeChildren().forEach((c) => c.destroy());
      uniq.forEach((s, i) => {
        const sp = new Sprite(statusTexture(s)) as Sprite & { sid?: string };
        sp.sid = s;
        sp.anchor.set(0.5);
        sp.width = sp.height = 12;
        sp.position.set(5 + i * 12.5, 0);
        v.icons.addChild(sp);
      });
    }
    v.icons.position.set(x, y - 9);
    if (v.label) {
      v.label.position.set(x + bw / 2, y - (uniq.length ? 17 : 4));
      v.label.alpha = v.alpha;
    }
    // Звёзды оглушения.
    if (v.alive && v.statuses.includes('stun')) {
      for (let j = 0; j < 3; j++) {
        const a = this.time / 260 + j * 2.09;
        g.circle(v.x + Math.cos(a) * 15, v.y - v.top + 4 + Math.sin(a) * 4, 2.6).fill('#ffd84a');
      }
    }
  }
}

function pick<T>(a: readonly T[]): T {
  return a[Math.floor(Math.random() * a.length)]!;
}
function fmt(n: number) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
function setTimeoutGame(v: BattleView, ms: number, fn: () => void) {
  void v.wait(ms).then(fn);
}
