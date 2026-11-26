/**
 * Процедурная музыка на Web Audio: ни одного аудиофайла, всё синтезируется на лету.
 *
 * Устройство — маленький секвенсор шестнадцатых с упреждающим планированием
 * («A Tale of Two Clocks»): таймер раз в 25 мс ставит в очередь ноты на 0,15 с вперёд,
 * поэтому ритм не плывёт, даже если главный поток занят боем.
 *
 * Темы:
 *  - camp — спокойный дорийский минор, тёплый пэд, арфа с эхом, флейта-мелодия;
 *  - battle — натуральный минор, 132 удара, бочка/малый/хэт, пульсирующий бас и квадратная мелодия;
 *  - boss — фригийский лад, гул в низах, тяжёлые барабаны, тревожное остинато.
 * Мелодия сочиняется детерминированно: на сильные доли — звуки аккорда, между ними — ход по ладу,
 * поэтому каждый проход цикла немного другой, но всегда «в гармонии».
 * Переключение тем — плавное перекрёстное затухание за 1,2 с.
 */

export type MusicId = 'camp' | 'battle' | 'boss';

interface Track {
  bpm: number;
  /** MIDI-нота тоники. */
  root: number;
  /** Ступени лада в полутонах. */
  scale: number[];
  /** Ступени аккордов по тактам (0 — тоника). Каждый аккорд — 1 такт. */
  chords: number[];
  pad: { type: OscillatorType; cutoff: number; gain: number } | null;
  bass: { pattern: string; type: OscillatorType; gain: number };
  arp?: { pattern: string; octave: number; gain: number; type: OscillatorType };
  lead?: { type: OscillatorType; gain: number; octave: number; density: number; vibrato?: boolean };
  drums?: { kick: string; snare: string; hat: string; gain: number };
  drone?: { gain: number };
  delay: { time: number; feedback: number; mix: number };
}

// Узоры — 16 шестнадцатых в такте: 'x' — удар/нота, '.' — пауза, цифра — ступень аккорда (для арпеджио).
const TRACKS: Record<MusicId, Track> = {
  camp: {
    bpm: 84,
    root: 50, // D
    scale: [0, 2, 3, 5, 7, 9, 10], // дорийский
    chords: [0, 3, 6, 4, 0, 3, 5, 4],
    pad: { type: 'sawtooth', cutoff: 900, gain: 0.065 },
    bass: { pattern: 'x.......x.......', type: 'triangle', gain: 0.22 },
    arp: { pattern: '0.1.2.1.0.1.2.3.', octave: 1, gain: 0.07, type: 'triangle' },
    lead: { type: 'sine', gain: 0.11, octave: 2, density: 0.45, vibrato: true },
    delay: { time: 0.36, feedback: 0.35, mix: 0.3 },
  },
  battle: {
    bpm: 132,
    root: 45, // A
    scale: [0, 2, 3, 5, 7, 8, 10], // натуральный минор
    chords: [0, 5, 2, 6, 0, 5, 3, 4],
    pad: { type: 'sawtooth', cutoff: 1400, gain: 0.035 },
    bass: { pattern: 'x.x.x.xxx.x.x.xx', type: 'sawtooth', gain: 0.1 },
    arp: { pattern: '0.2.1.2.0.2.1.3.', octave: 2, gain: 0.04, type: 'square' },
    lead: { type: 'square', gain: 0.045, octave: 2, density: 0.6 },
    drums: { kick: 'x...x...x...x.x.', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.xx', gain: 0.5 },
    delay: { time: 0.227, feedback: 0.25, mix: 0.18 },
  },
  boss: {
    bpm: 112,
    root: 40, // E
    scale: [0, 1, 3, 5, 7, 8, 10], // фригийский
    chords: [0, 1, 0, 5, 0, 1, 6, 4],
    pad: { type: 'sawtooth', cutoff: 700, gain: 0.045 },
    bass: { pattern: 'x..x..x.x..x..x.', type: 'sawtooth', gain: 0.13 },
    arp: { pattern: '0101010101010101', octave: 1, gain: 0.035, type: 'square' },
    lead: { type: 'sawtooth', gain: 0.035, octave: 2, density: 0.35 },
    drums: { kick: 'x..x..x.x..x..x.', snare: '....x.......x..x', hat: '..x...x...x...x.', gain: 0.6 },
    drone: { gain: 0.06 },
    delay: { time: 0.4, feedback: 0.4, mix: 0.25 },
  },
};

const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const FADE = 1.2;

const midiHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** Детерминированный генератор (mulberry32) — для мелодии. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Player {
  readonly out: GainNode;
  private delayIn: GainNode;
  private step = 0;
  private next: number;
  private noise: AudioBuffer;
  private rand: () => number;
  private leadDeg = 0;
  private droneNodes: AudioScheduledSourceNode[] = [];

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
    private t: Track,
    seed: number,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    // Эхо: вход → задержка ⇄ обратная связь → выход.
    this.delayIn = ctx.createGain();
    const d = ctx.createDelay(1);
    d.delayTime.value = t.delay.time;
    const fb = ctx.createGain();
    fb.gain.value = t.delay.feedback;
    const wet = ctx.createGain();
    wet.gain.value = t.delay.mix;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2500;
    this.delayIn.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(wet).connect(this.out);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.rand = rng(seed);
    this.next = ctx.currentTime + 0.05;
    if (t.drone) this.startDrone();
  }

  fadeIn() {
    const g = this.out.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1, now + FADE);
  }

  /** Затухание и остановка; возвращает момент полной тишины. */
  fadeOut(): number {
    const g = this.out.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + FADE);
    for (const n of this.droneNodes) n.stop(now + FADE + 0.05);
    return now + FADE;
  }

  dispose() {
    this.out.disconnect();
  }

  private get stepDur() {
    return 60 / this.t.bpm / 4;
  }

  /** Поставить в очередь всё, что звучит в ближайшие LOOKAHEAD секунд. */
  pump() {
    const horizon = this.ctx.currentTime + LOOKAHEAD;
    // После сна вкладки не догоняем пропущенное, а начинаем с текущего момента.
    if (this.next < this.ctx.currentTime - 0.5) this.next = this.ctx.currentTime + 0.05;
    while (this.next < horizon) {
      this.playStep(this.step, this.next);
      this.step = (this.step + 1) % (16 * this.t.chords.length);
      this.next += this.stepDur;
    }
  }

  private chordAt(step: number): number[] {
    const bar = Math.floor(step / 16) % this.t.chords.length;
    const deg = this.t.chords[bar]!;
    return [deg, deg + 2, deg + 4, deg + 6];
  }

  /** Ступень лада (может выходить за октаву) → MIDI. */
  private note(deg: number, octave: number): number {
    const n = this.t.scale.length;
    const o = Math.floor(deg / n);
    const i = ((deg % n) + n) % n;
    return this.t.root + 12 * (octave + o) + this.t.scale[i]!;
  }

  private playStep(step: number, time: number) {
    const s = step % 16;
    const t = this.t;
    const chord = this.chordAt(step);
    const beat = this.stepDur * 4;
    // Пэд — в начале такта, держится весь такт.
    if (t.pad && s === 0)
      for (const d of chord.slice(0, 3))
        this.pad(midiHz(this.note(d, 1)), time, beat * 4, t.pad.type, t.pad.cutoff, t.pad.gain);
    if (t.bass.pattern[s] === 'x') {
      // На последних шестнадцатых — проходящий звук к следующему аккорду.
      const d = s >= 14 ? this.chordAt(step + 16)[0]! - 1 : chord[0]!;
      this.tone(midiHz(this.note(d, 0)), time, this.stepDur * 1.8, t.bass.type, t.bass.gain, 600);
    }
    const a = t.arp?.pattern[s];
    if (t.arp && a && a !== '.') {
      const d = chord[Number(a)] ?? chord[0]!;
      this.tone(
        midiHz(this.note(d, t.arp.octave)),
        time,
        this.stepDur * 1.5,
        t.arp.type,
        t.arp.gain,
        3200,
        true,
      );
    }
    if (t.lead && s % 2 === 0) this.leadStep(s, chord, time);
    if (t.drums) {
      if (t.drums.kick[s] === 'x') this.kick(time, t.drums.gain);
      if (t.drums.snare[s] === 'x') this.snare(time, t.drums.gain * 0.6);
      if (t.drums.hat[s] === 'x') this.hat(time, t.drums.gain * (s % 4 === 0 ? 0.25 : 0.15));
    }
  }

  private leadStep(s: number, chord: number[], time: number) {
    const l = this.t.lead!;
    const strong = s % 8 === 0;
    if (!strong && this.rand() > l.density) return;
    if (strong) {
      // Сильная доля — ближайший к текущей ноте звук аккорда.
      const tones = chord.slice(0, 3).flatMap((d) => [d, d + 7]);
      this.leadDeg = tones.reduce((b, d) =>
        Math.abs(d - this.leadDeg) < Math.abs(b - this.leadDeg) ? d : b,
      );
    } else {
      const r = this.rand();
      this.leadDeg += r < 0.4 ? 1 : r < 0.8 ? -1 : r < 0.9 ? 2 : -2;
    }
    this.leadDeg = Math.max(-3, Math.min(9, this.leadDeg));
    const len = strong ? this.stepDur * (this.rand() < 0.5 ? 4 : 2.5) : this.stepDur * 1.8;
    this.tone(midiHz(this.note(this.leadDeg, l.octave)), time, len, l.type, l.gain, 2600, true, l.vibrato);
  }

  private env(g: GainNode, time: number, dur: number, peak: number, attack = 0.01) {
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(peak, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  }

  private tone(
    hz: number,
    time: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    cutoff: number,
    echo = false,
    vibrato = false,
  ) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(hz, time);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    this.env(g, time, dur, gain, 0.012);
    o.connect(f).connect(g).connect(this.out);
    if (echo) g.connect(this.delayIn);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.value = hz * 0.006;
      lfo.connect(depth).connect(o.frequency);
      lfo.start(time);
      lfo.stop(time + dur + 0.05);
    }
    o.start(time);
    o.stop(time + dur + 0.05);
  }

  private pad(hz: number, time: number, dur: number, type: OscillatorType, cutoff: number, gain: number) {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + dur * 0.3);
    g.gain.setValueAtTime(gain, time + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur + 0.3);
    f.connect(g).connect(this.out);
    g.connect(this.delayIn);
    for (const detune of [-8, 7]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = hz;
      o.detune.value = detune;
      o.connect(f);
      o.start(time);
      o.stop(time + dur + 0.4);
    }
  }

  private kick(time: number, gain: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(42, time + 0.14);
    const g = this.ctx.createGain();
    this.env(g, time, 0.32, gain, 0.003);
    o.connect(g).connect(this.out);
    o.start(time);
    o.stop(time + 0.35);
  }

  private noiseHit(time: number, dur: number, gain: number, type: BiquadFilterType, freq: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    this.env(g, time, dur, gain, 0.002);
    src.connect(f).connect(g).connect(this.out);
    src.start(time, Math.random() * 0.3);
    src.stop(time + dur + 0.02);
  }

  private snare(time: number, gain: number) {
    this.noiseHit(time, 0.18, gain, 'bandpass', 1900);
    this.tone(190, time, 0.09, 'triangle', gain * 0.5, 2000);
  }

  private hat(time: number, gain: number) {
    this.noiseHit(time, 0.045, gain, 'highpass', 7500);
  }

  private startDrone() {
    const ctx = this.ctx;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 220;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const depth = ctx.createGain();
    depth.gain.value = 90;
    lfo.connect(depth).connect(f.frequency);
    const g = ctx.createGain();
    g.gain.value = this.t.drone!.gain;
    f.connect(g).connect(this.out);
    for (const m of [this.t.root - 12, this.t.root - 5]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midiHz(m);
      o.connect(f);
      o.start();
      this.droneNodes.push(o);
    }
    lfo.start();
    this.droneNodes.push(lfo);
  }
}

/** Музыкальный плеер поверх общего AudioContext. */
export class MusicEngine {
  private bus: GainNode;
  private cur: { id: MusicId; p: Player } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private seed = 1;

  constructor(
    private ctx: AudioContext,
    dest: AudioNode,
  ) {
    this.bus = ctx.createGain();
    // Лёгкая компрессия, чтобы пики барабанов не перегружали выход.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    this.bus.connect(comp).connect(dest);
  }

  setVolume(v: number) {
    const now = this.ctx.currentTime;
    this.bus.gain.cancelScheduledValues(now);
    this.bus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), now, 0.1);
  }

  play(id: MusicId | null) {
    if (this.cur?.id === id) return;
    if (this.cur) {
      const old = this.cur.p;
      const end = old.fadeOut();
      setTimeout(() => old.dispose(), (end - this.ctx.currentTime + 0.2) * 1000);
    }
    this.cur = null;
    if (!id) return this.stopTimer();
    const p = new Player(this.ctx, this.bus, TRACKS[id], this.seed++);
    p.fadeIn();
    this.cur = { id, p };
    if (!this.timer) this.timer = setInterval(() => this.cur?.p.pump(), TICK_MS);
    p.pump();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get current(): MusicId | null {
    return this.cur?.id ?? null;
  }
}
