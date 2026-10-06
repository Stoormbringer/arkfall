// @vitest-environment jsdom
// @vitest-environment-options {"resources":"usable","pretendToBeVisual":true}
import { afterEach, describe, expect, it } from 'vitest';
import { KEYS, killAll, Sim } from './harness';

let sim: Sim;
afterEach(() => sim?.destroy());

const startRun = async (search: string) => {
  sim = await Sim.create(search);
  sim.step(300);
  expect(sim.active('facet')).toBe(true);
  sim.key('Digit1', KEYS.ONE); // стартовая Руна
  sim.step(2500);              // вход 0,7 с + телеграф 1 с
};

describe('поток забега (headless)', () => {
  it('старт: стартовая Руна → враги появляются, комната не считается пройденной', async () => {
    await startRun('?tier=1&seed=42');
    const s = sim.snap!;
    expect(s.room).toBe(1);
    expect(s.alive).toBeGreaterThan(0);
    expect(sim.active('door')).toBe(false);
  }, 30_000);

  it('зачистка → Руна за Ранг (если набран) → дверь → следующая комната с врагами', async () => {
    await startRun('?tier=1&seed=42');
    killAll(sim);
    sim.step(1500);
    // накопленные Ранги дают выбор Руны — выбираем, пока экран открыт
    for (let i = 0; i < 5 && sim.active('facet'); i++) { sim.key('Digit1', KEYS.ONE); sim.step(400); }
    expect(sim.active('door')).toBe(true);
    expect(sim.paused('arena')).toBe(true);
    sim.key('Digit1', KEYS.ONE); // дверь
    sim.step(300);
    expect(sim.active('door')).toBe(false);
    expect(sim.paused('arena')).toBe(false);
    sim.step(2500);
    const s = sim.snap!;
    expect(s.room).toBe(2);
    expect(s.alive).toBeGreaterThan(0);
  }, 30_000);

  it('три комнаты подряд без зависаний', async () => {
    await startRun('?tier=1&seed=7');
    for (let room = 1; room <= 3; room++) {
      expect(sim.snap!.room).toBe(room);
      expect(sim.snap!.alive).toBeGreaterThan(0);
      killAll(sim);
      sim.step(1500);
      for (let i = 0; i < 5 && sim.active('facet'); i++) { sim.key('Digit1', KEYS.ONE); sim.step(400); }
      expect(sim.active('door')).toBe(true);
      sim.key('Digit1', KEYS.ONE);
      sim.step(2800);
    }
    expect(sim.snap!.room).toBe(4);
  }, 60_000);
});

describe('смерть и босс (headless)', () => {
  it('смерть → итоги → Enter → хаб → Enter → новый забег со стартовой Рунаю', async () => {
    await startRun('?tier=1&seed=42');
    const arena = sim.game.scene.getScene('arena') as unknown as { hitPlayer: (d: number, s: string) => void; player: { invulnUntil: number } };
    arena.player.invulnUntil = 0;
    arena.hitPlayer(9999, 'тест');
    sim.step(2000);
    expect(sim.active('summary')).toBe(true);
    sim.key('Enter', KEYS.ENTER);
    sim.step(300);
    expect(sim.active('title')).toBe(true);
    expect(sim.active('arena')).toBe(false);
    sim.key('Enter', KEYS.ENTER); // Нырнуть
    sim.step(400);
    expect(sim.active('facet')).toBe(true); // стартовая Руна нового забега
    sim.key('Digit1', KEYS.ONE);
    sim.step(2500);
    expect(sim.snap!.room).toBe(1);
    expect(sim.snap!.alive).toBeGreaterThan(0);
  }, 30_000);

  it('10-я комната: босс появляется, после его смерти — дверь или Руна, без зависания', async () => {
    sim = await Sim.create('?tier=1&seed=42&room=10');
    sim.step(2800);
    expect(sim.snap!.boss?.name).toBe('Молот Ковчега');
    killAll(sim);
    sim.step(1500);
    expect(sim.active('facet') || sim.active('door')).toBe(true);
  }, 30_000);
});
