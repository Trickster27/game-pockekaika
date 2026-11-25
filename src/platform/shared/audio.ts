import type { AudioAdapter, SoundId } from '../types';

type Tone = { f: number; to?: number; d: number; type?: OscillatorType; gain?: number; delay?: number };

/**
 * Временные звуки, синтезированные Web Audio: не нужно ни одного файла.
 * Позже их можно заменить на сэмплы (AudioBuffer из ogg/m4a) с тем же SoundId.
 */
const SOUNDS: Record<SoundId, Tone[]> = {
  tap: [{ f: 660, d: 0.04, type: 'triangle', gain: 0.15 }],
  hit: [{ f: 180, to: 80, d: 0.12, type: 'square', gain: 0.18 }],
  crit: [
    { f: 220, to: 60, d: 0.18, type: 'sawtooth', gain: 0.22 },
    { f: 880, to: 1320, d: 0.12, type: 'triangle', gain: 0.12, delay: 0.03 },
  ],
  heal: [
    { f: 520, to: 780, d: 0.25, type: 'sine', gain: 0.16 },
    { f: 780, to: 1040, d: 0.25, type: 'sine', gain: 0.1, delay: 0.08 },
  ],
  victory: [
    { f: 523, d: 0.14, type: 'triangle', gain: 0.18 },
    { f: 659, d: 0.14, type: 'triangle', gain: 0.18, delay: 0.14 },
    { f: 784, d: 0.3, type: 'triangle', gain: 0.2, delay: 0.28 },
  ],
  reward: [
    { f: 988, d: 0.08, type: 'sine', gain: 0.14 },
    { f: 1319, d: 0.16, type: 'sine', gain: 0.14, delay: 0.07 },
  ],
};

export class WebAudioAdapter implements AudioAdapter {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private volume = 0.7;
  private muted = false;

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor =
      (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
        .AudioContext ?? (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    return this.ctx;
  }

  unlock() {
    const ctx = this.ensure();
    if (ctx?.state === 'suspended') void ctx.resume();
  }

  play(id: SoundId) {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    for (const t of SOUNDS[id]) {
      const start = now + (t.delay ?? 0);
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = t.type ?? 'sine';
      osc.frequency.setValueAtTime(t.f, start);
      if (t.to) osc.frequency.exponentialRampToValueAtTime(t.to, start + t.d);
      g.gain.setValueAtTime(t.gain ?? 0.15, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + t.d);
      osc.connect(g).connect(this.master);
      osc.start(start);
      osc.stop(start + t.d + 0.02);
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.master && !this.muted) this.master.gain.value = this.volume;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : this.volume;
  }
}
