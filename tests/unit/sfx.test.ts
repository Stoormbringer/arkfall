import { describe, expect, it } from 'vitest';
import { play, startAmbient, attachAudio } from '../../src/audio/sfx';

describe('звук (синтез Web Audio)', () => {
  it('без AudioContext (Node) модуль молчит и не падает', () => {
    expect(typeof (globalThis as { AudioContext?: unknown }).AudioContext).toBe('undefined');
    expect(() => play('hit')).not.toThrow();
    expect(() => startAmbient()).not.toThrow();
    expect(() => attachAudio({ events: { on: () => undefined } } as unknown as Phaser.Game)).not.toThrow();
  });
  it('с подставным контекстом каждый рецепт создаёт узлы и не бросает', async () => {
    const made: string[] = [];
    class FakeParam { value = 0; setValueAtTime() { return this; } exponentialRampToValueAtTime() { return this; } }
    const node = () => ({ connect() { return this; }, start() { /* */ }, stop() { /* */ }, gain: new FakeParam(), frequency: new FakeParam(), Q: new FakeParam(), type: '', buffer: null });
    class FakeCtx {
      state = 'running'; currentTime = 0; sampleRate = 8000; destination = {};
      createGain() { made.push('gain'); return node(); }
      createOscillator() { made.push('osc'); return node(); }
      createBufferSource() { made.push('src'); return node(); }
      createBiquadFilter() { made.push('filter'); return node(); }
      createBuffer() { return { getChannelData: () => new Float32Array(16) }; }
      resume() { return Promise.resolve(); }
    }
    (globalThis as unknown as { AudioContext: unknown }).AudioContext = FakeCtx;
    (globalThis as unknown as { window: unknown }).window = globalThis;
    const { play: p } = await import('../../src/audio/sfx');
    for (const n of ['swing', 'hit', 'kill', 'hurt', 'dash', 'shot', 'explode', 'rune', 'door', 'gold', 'parry', 'blink', 'boss_phase', 'slam', 'ui', 'win', 'death'] as const) {
      expect(() => p(n)).not.toThrow();
    }
    expect(made.filter((m) => m === 'osc').length).toBeGreaterThan(10);
    delete (globalThis as { AudioContext?: unknown }).AudioContext;
  });
});
