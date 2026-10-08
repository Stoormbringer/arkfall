import type Phaser from 'phaser';
import { loadSettings } from '../meta/Settings';

/**
 * Звук (пакет S1): всё синтезируется Web Audio на лету — ни одного файла.
 * Игра шлёт game.events 'sfx' с именем; модуль слушает и играет. Эмбиент — низкий гул + редкие капли.
 * Контекст стартует по первому жесту пользователя (политика автозапуска браузеров). В headless (Node) модуль молчит.
 */
export type SfxName =
  | 'swing' | 'hit' | 'kill' | 'hurt' | 'dash' | 'shot' | 'explode' | 'rune' | 'door' | 'gold' | 'parry'
  | 'blink' | 'boss_phase' | 'slam' | 'ui' | 'win' | 'death' | 'torch';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxGain: GainNode | null = null;
let ambGain: GainNode | null = null;
let ambientOn = false;
let noiseBuf: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(master);
    ambGain = ctx.createGain(); ambGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function applyVolumes() {
  const s = loadSettings();
  if (sfxGain) sfxGain.gain.value = s.sfxVolume;
  if (ambGain) ambGain.gain.value = s.musicVolume * 0.6;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slideTo?: number, when = 0) {
  const c = ensure(); if (!c || !sfxGain) return;
  const o = c.createOscillator(), g = c.createGain();
  const t = c.currentTime + when;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxGain); o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, filterHz: number, q = 1, when = 0, type: BiquadFilterType = 'bandpass') {
  const c = ensure(); if (!c || !sfxGain || !noiseBuf) return;
  const src = c.createBufferSource(); src.buffer = noiseBuf;
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = filterHz; f.Q.value = q;
  const g = c.createGain();
  const t = c.currentTime + when;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain); src.start(t); src.stop(t + dur + 0.02);
}

const RECIPES: Record<SfxName, () => void> = {
  swing: () => noise(0.12, 0.25, 1800, 0.8, 0, 'highpass'),
  hit: () => { noise(0.07, 0.5, 900, 1.2); tone(180, 0.08, 'square', 0.15, 90); },
  kill: () => { noise(0.18, 0.5, 500, 0.8); tone(140, 0.22, 'sawtooth', 0.2, 40); },
  hurt: () => { tone(220, 0.18, 'square', 0.3, 110); noise(0.12, 0.3, 300, 0.7); },
  dash: () => noise(0.16, 0.3, 2500, 0.6, 0, 'highpass'),
  shot: () => tone(620, 0.1, 'triangle', 0.18, 240),
  explode: () => { noise(0.45, 0.8, 120, 0.5, 0, 'lowpass'); tone(70, 0.4, 'sine', 0.5, 30); },
  rune: () => { tone(660, 0.12, 'sine', 0.2); tone(990, 0.14, 'sine', 0.2, undefined, 0.09); tone(1320, 0.22, 'sine', 0.2, undefined, 0.18); },
  door: () => { noise(0.3, 0.3, 200, 0.5, 0, 'lowpass'); tone(90, 0.3, 'sine', 0.25, 60); },
  gold: () => { tone(1500, 0.05, 'square', 0.08); tone(2000, 0.07, 'square', 0.08, undefined, 0.04); },
  parry: () => { tone(1200, 0.08, 'square', 0.2, 1800); noise(0.08, 0.3, 3000, 1, 0, 'highpass'); },
  blink: () => { tone(400, 0.25, 'sine', 0.2, 1600); noise(0.2, 0.2, 1200, 2); },
  boss_phase: () => { tone(60, 0.9, 'sawtooth', 0.35, 30); noise(0.6, 0.5, 150, 0.5, 0, 'lowpass'); tone(120, 0.5, 'square', 0.15, 45, 0.1); },
  slam: () => { noise(0.3, 0.6, 100, 0.5, 0, 'lowpass'); tone(55, 0.3, 'sine', 0.5, 25); },
  ui: () => tone(880, 0.05, 'square', 0.06),
  win: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.18, undefined, i * 0.12)); },
  death: () => { tone(300, 0.6, 'sawtooth', 0.25, 50); noise(0.5, 0.3, 200, 0.5, 0, 'lowpass'); },
  torch: () => noise(0.5, 0.05, 600, 0.5),
};

const lastAt = new Map<SfxName, number>();
/** Воспроизвести; одинаковые звуки чаще чем раз в 35 мс не играются (дуговой удар по толпе — один звук) */
export function play(name: SfxName) {
  const c = ensure(); if (!c) return;
  const now = c.currentTime;
  if ((lastAt.get(name) ?? -1) > now - 0.035) return;
  lastAt.set(name, now);
  RECIPES[name]?.();
}

/** Эмбиент подземелья: два расстроенных гула + случайные капли */
export function startAmbient() {
  const c = ensure(); if (!c || !ambGain || ambientOn) return;
  ambientOn = true;
  for (const [f, type] of [[55, 'sine'], [57.5, 'triangle'], [110, 'sine']] as [number, OscillatorType][]) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f; g.gain.value = f > 100 ? 0.04 : 0.09;
    o.connect(g); g.connect(ambGain); o.start();
  }
  const drip = () => {
    if (!ctx || !ambGain) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    const t = ctx.currentTime;
    o.type = 'sine'; o.frequency.setValueAtTime(1800 + Math.random() * 900, t); o.frequency.exponentialRampToValueAtTime(600, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g); g.connect(ambGain); o.start(t); o.stop(t + 0.3);
    setTimeout(drip, 2500 + Math.random() * 6000);
  };
  setTimeout(drip, 2000);
}

/** Подключение к игре: слушаем события и первый жест пользователя */
export function attachAudio(game: Phaser.Game) {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return;
  const wake = () => { ensure(); startAmbient(); applyVolumes(); };
  window.addEventListener('pointerdown', wake, { once: true });
  window.addEventListener('keydown', wake, { once: true });
  game.events.on('sfx', (name: SfxName) => play(name));
  game.events.on('settings-changed', applyVolumes);
}
