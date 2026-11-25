import { Application, Assets, Container, Graphics, Sprite, Text, type Texture } from 'pixi.js';
import { unitArtMeta, unitArtUrl, UNIT_FRAME } from '@/assets/art';

/** Логический размер поля. Сцена масштабируется под экран с сохранением пропорций. */
export const FIELD = { width: 360, height: 520 } as const;
const LEAD = 0x0a0710;

export interface StageUnit {
  key: string;
  side: 'ally' | 'enemy';
  x: number;
  y: number;
  scale: number;
}

export interface BattleStageOptions {
  units: StageUnit[];
  maxFps?: number;
  onFps?: (fps: number) => void;
  onHit?: (crit: boolean) => void;
}

export interface BattleStageHandle {
  destroy(): void;
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shade(hex: number, k: number) {
  const r = (hex >> 16) & 255,
    g = (hex >> 8) & 255,
    b = hex & 255;
  const t = k < 0 ? 0 : 255,
    p = Math.abs(k);
  const m = (v: number) => Math.round((t - v) * p + v);
  return (m(r) << 16) | (m(g) << 8) | m(b);
}

/** Витражный фон: сетка с джиттером, каждая ячейка — «стекло» со свинцовой обводкой. */
function drawBackground(seed: number): Graphics {
  const g = new Graphics();
  const R = mulberry(seed);
  const cols = 6,
    rows = 10;
  const pts: [number, number][][] = [];
  for (let r = 0; r <= rows; r++) {
    const row: [number, number][] = [];
    for (let q = 0; q <= cols; q++) {
      let x = (q * FIELD.width) / cols,
        y = (r * FIELD.height) / rows;
      if (q > 0 && q < cols) x += (R() - 0.5) * (FIELD.width / cols) * 0.6;
      if (r > 0 && r < rows) y += (R() - 0.5) * (FIELD.height / rows) * 0.6;
      row.push([x, y]);
    }
    pts.push(row);
  }
  const sky = [0x1f2a55, 0x2a1f4d, 0x33285e, 0x24346a],
    mid = [0x2a2248, 0x3a2d5c, 0x30264f],
    near = [0x2b3a2c, 0x314330, 0x2f402b, 0x3a4a2e];
  for (let r = 0; r < rows; r++)
    for (let q = 0; q < cols; q++) {
      const a = pts[r]![q]!,
        b = pts[r]![q + 1]!,
        c = pts[r + 1]![q + 1]!,
        d = pts[r + 1]![q]!;
      const cy = (a[1] + c[1]) / 2;
      const pal = cy < 140 ? sky : cy < 300 ? mid : near;
      const base = pal[Math.floor(R() * pal.length)]!;
      const quads =
        R() < 0.45
          ? [
              [a, b, c],
              [a, c, d],
            ]
          : [[a, b, c, d]];
      for (const poly of quads) {
        g.poly(poly.flat())
          .fill(shade(base, (R() - 0.5) * 0.2))
          .stroke({ width: 3, color: LEAD, join: 'round' });
      }
    }
  // Осколок солнца в небе.
  g.circle(300, 46, 60).fill({ color: 0xf0c860, alpha: 0.12 });
  g.poly([286, 30, 310, 16, 326, 42, 306, 66, 282, 52])
    .fill(0xf0c860)
    .stroke({ width: 3, color: LEAD, join: 'round' });
  return g;
}

/** Создаёт сцену боя в host. Возвращает handle для уничтожения при уходе с экрана. */
export async function createBattleStage(
  host: HTMLElement,
  opts: BattleStageOptions,
): Promise<BattleStageHandle> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: 0x15122a,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    preference: 'webgl',
  });
  // Ограничиваем FPS: на слабых телефонах так меньше греется и дольше живёт батарея.
  app.ticker.maxFPS = opts.maxFps ?? 60;
  host.appendChild(app.canvas);

  const world = new Container();
  app.stage.addChild(world);
  world.addChild(drawBackground(7));

  const keys = [...new Set(opts.units.map((u) => u.key))];
  const textures = new Map<string, Texture>();
  await Promise.all(
    keys.map(async (k) => {
      const url = unitArtUrl(k);
      if (url) textures.set(k, await Assets.load<Texture>({ src: url, data: { resolution: 2 } }));
    }),
  );

  const fx = new Container();
  const ordered = [...opts.units].sort((a, b) => a.y - b.y);
  const bodies: {
    unit: StageUnit;
    sprite: Sprite;
    hp: Graphics;
    hpFrac: number;
    phase: number;
    baseScale: number;
    flash: number;
  }[] = [];

  for (const [i, u] of ordered.entries()) {
    const tex = textures.get(u.key);
    if (!tex) continue;
    const meta = unitArtMeta(u.key);
    const scale = u.scale * meta.scale;
    const shadow = new Graphics()
      .ellipse(u.x, u.y, 22 * scale, 6 * scale)
      .fill({ color: 0x05030a, alpha: 0.45 });
    world.addChild(shadow);
    const sprite = new Sprite(tex);
    sprite.anchor.set(UNIT_FRAME.footX / UNIT_FRAME.width, UNIT_FRAME.footY / UNIT_FRAME.height);
    const baseScale = (UNIT_FRAME.height * scale) / tex.height;
    sprite.scale.set(baseScale);
    sprite.position.set(u.x, u.y);
    world.addChild(sprite);
    const hp = new Graphics();
    const body = { unit: u, sprite, hp, hpFrac: 1, phase: i * 1.7, baseScale, flash: 0 };
    const drawHp = () => {
      const w = 44,
        x = u.x - w / 2,
        y = u.y - meta.top * scale - 14;
      hp.clear()
        .rect(x - 1.5, y - 1.5, w + 3, 9)
        .fill(LEAD)
        .rect(x, y, w * body.hpFrac, 6)
        .fill(u.side === 'ally' ? 0x5fcf6f : 0xe2474f);
    };
    drawHp();
    bodies.push(body);
    if (u.side === 'enemy') {
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.on('pointertap', () => {
        const crit = Math.random() < 0.3;
        body.hpFrac = body.hpFrac <= 0.05 ? 1 : Math.max(0, body.hpFrac - (crit ? 0.35 : 0.15));
        body.flash = 1;
        drawHp();
        spawnHit(u.x, u.y - meta.top * scale * 0.5, crit);
        floatText(u.x, u.y - meta.top * scale - 26, crit ? '−1 248' : '−684', crit);
        opts.onHit?.(crit);
      });
    }
  }
  for (const b of bodies) world.addChild(b.hp);
  world.addChild(fx);

  type Particle = { g: Graphics; vx: number; vy: number; life: number; max: number };
  const particles: Particle[] = [];
  function spawnHit(x: number, y: number, crit: boolean) {
    const n = crit ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2,
        sp = 80 + Math.random() * (crit ? 260 : 160);
      const g = new Graphics().circle(0, 0, 2 + Math.random() * 2.5).fill(crit ? 0xffd84a : 0xfff3c4);
      g.position.set(x, y);
      g.blendMode = 'add';
      fx.addChild(g);
      particles.push({ g, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 450, max: 450 });
    }
  }
  const texts: { t: Text; life: number; y0: number }[] = [];
  function floatText(x: number, y: number, s: string, crit: boolean) {
    const t = new Text({
      text: s,
      style: {
        fontFamily: 'Philosopher, Georgia, serif',
        fontWeight: '700',
        fontSize: crit ? 24 : 18,
        fill: crit ? 0xffd84a : 0xffffff,
        stroke: { color: LEAD, width: crit ? 5 : 4, join: 'round' },
      },
    });
    t.anchor.set(0.5);
    t.position.set(x, y);
    fx.addChild(t);
    texts.push({ t, life: 900, y0: y });
  }

  // Подгонка мира под размер экрана (contain + центрирование).
  const layout = () => {
    // app.screen — размер в CSS-пикселях, плотность экрана уже учтена.
    const w = app.screen.width,
      h = app.screen.height;
    const k = Math.min(w / FIELD.width, h / FIELD.height);
    world.scale.set(k);
    world.position.set((w - FIELD.width * k) / 2, (h - FIELD.height * k) / 2);
  };
  layout();
  app.renderer.on('resize', layout);

  let time = 0,
    fpsAcc = 0;
  app.ticker.add((tk) => {
    const dt = tk.deltaMS;
    time += dt;
    for (const b of bodies) {
      const bob = Math.sin(time / 420 + b.phase) * 0.022;
      b.sprite.scale.set(b.baseScale, b.baseScale * (1 + bob));
      if (b.flash > 0) {
        b.flash = Math.max(0, b.flash - dt / 260);
        b.sprite.tint = b.flash > 0.01 ? 0xff9a9a : 0xffffff;
        b.sprite.y = b.unit.y - b.flash * 6;
      }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.life -= dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.g.x += (p.vx * dt) / 1000;
      p.g.y += (p.vy * dt) / 1000;
      p.g.alpha = p.life / p.max;
      if (p.life <= 0) {
        p.g.destroy();
        particles.splice(i, 1);
      }
    }
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]!;
      t.life -= dt;
      const k = 1 - t.life / 900;
      t.t.y = t.y0 - 26 * (1 - (1 - k) ** 3);
      t.t.alpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      if (t.life <= 0) {
        t.t.destroy();
        texts.splice(i, 1);
      }
    }
    fpsAcc += dt;
    if (fpsAcc > 500) {
      fpsAcc = 0;
      opts.onFps?.(Math.round(app.ticker.FPS));
    }
  });

  // Вкладка скрыта или приложение свёрнуто — не рендерим вовсе.
  const onVis = () => (document.hidden ? app.ticker.stop() : app.ticker.start());
  document.addEventListener('visibilitychange', onVis);

  return {
    destroy() {
      document.removeEventListener('visibilitychange', onVis);
      app.renderer.off('resize', layout);
      app.destroy({ removeView: true }, { children: true });
    },
  };
}
