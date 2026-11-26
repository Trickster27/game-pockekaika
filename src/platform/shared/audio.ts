import type { AudioAdapter, MusicId, SoundId } from '../types';
import { MusicEngine } from './music';

type Tone = { f: number; to?: number; d: number; type?: OscillatorType; gain?: number; delay?: number };

/**
 * Временные звуки, синтезированные Web Audio: не нужно ни одного файла.
 * Позже их можно заменить на сэмплы (AudioBuffer из ogg/m4a) с тем же SoundId.
 */
const SOUNDS: Record<SoundId, Tone[]> = {
  tap: [{ f: 660, d: 0.04, type: 'triangle', gain: 0.15 }],
  hit: [{ f: 180, to: 80, d: 0.12, type: 'square', gain: 0.18 }],
  // Удары по стихиям: у каждой свой тембр, чтобы бой было слышно.
  hit_fire: [
    { f: 260, to: 90, d: 0.14, type: 'sawtooth', gain: 0.14 },
    { f: 1400, to: 600, d: 0.08, type: 'square', gain: 0.05, delay: 0.01 },
  ],
  hit_thorn: [
    { f: 420, to: 180, d: 0.09, type: 'triangle', gain: 0.16 },
    { f: 900, to: 700, d: 0.05, type: 'square', gain: 0.05, delay: 0.03 },
  ],
  hit_stone: [{ f: 120, to: 50, d: 0.16, type: 'square', gain: 0.22 }],
  hit_tide: [
    { f: 340, to: 160, d: 0.16, type: 'sine', gain: 0.2 },
    { f: 520, to: 260, d: 0.12, type: 'sine', gain: 0.08, delay: 0.04 },
  ],
  hit_light: [
    { f: 880, to: 440, d: 0.1, type: 'triangle', gain: 0.13 },
    { f: 1760, to: 1320, d: 0.12, type: 'sine', gain: 0.06, delay: 0.02 },
  ],
  hit_dark: [
    { f: 150, to: 60, d: 0.2, type: 'sawtooth', gain: 0.15 },
    { f: 75, to: 40, d: 0.2, type: 'sine', gain: 0.15, delay: 0.02 },
  ],
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
  private musicEngine: MusicEngine | null = null;
  private musicWant: MusicId | null = null;
  private musicOn = true;
  private musicVol = 0.5;
  private hidden = false;

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
    if (ctx?.state === 'suspended' && !this.hidden) void ctx.resume();
    this.syncMusic();
  }

  private syncMusic() {
    const ctx = this.ensure();
    if (!ctx) return;
    if (!this.musicEngine) {
      // Пока звук не разблокирован жестом, музыку не создаём: запомненная тема начнётся по первому касанию.
      if (ctx.state !== 'running' || !this.musicOn || !this.musicWant) return;
      this.musicEngine = new MusicEngine(ctx, ctx.destination);
      this.musicEngine.setVolume(this.musicVol * 0.6);
    }
    this.musicEngine.play(this.musicOn ? this.musicWant : null);
  }

  music(id: MusicId | null) {
    this.musicWant = id;
    this.syncMusic();
  }

  setMusicVolume(volume: number) {
    this.musicVol = Math.max(0, Math.min(1, volume));
    this.musicEngine?.setVolume(this.musicVol * 0.6);
  }

  setMusicEnabled(on: boolean) {
    this.musicOn = on;
    if (this.musicEngine || on) this.syncMusic();
  }

  suspend() {
    this.hidden = true;
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume() {
    this.hidden = false;
    if (this.ctx?.state === 'suspended') void this.ctx.resume().then(() => this.syncMusic());
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
