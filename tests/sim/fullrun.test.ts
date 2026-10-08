// @vitest-environment jsdom
// @vitest-environment-options {"resources":"usable","pretendToBeVisual":true}
import { afterEach, describe, expect, it } from 'vitest';
import { KEYS, killAll, passOverlays, Sim } from './harness';

let sim: Sim;
afterEach(() => sim?.destroy());

/** Комната: дождаться появления, выбить всех (включая подмогу Призывателя и босса), пройти оверлеи, выбрать дверь */
function clearRoom(sim: Sim, seen: Set<string>) {
  sim.step(2500);
  const arena = sim.game.scene.getScene('arena') as unknown as { enemies: Phaser.GameObjects.Group; player: { invulnUntil: number } };
  arena.player.invulnUntil = 1e12; // герой стоит на месте — проверяем поток, а не выживание (баланс — в таблице TTK)
  for (const e of arena.enemies.getChildren() as { id: string }[]) seen.add(e.id);
  for (let i = 0; i < 12; i++) {
    killAll(sim);
    sim.step(600);
    if (sim.active('facet') || sim.active('shop') || sim.active('door') || sim.active('summary')) break;
  }
  sim.step(900);
  passOverlays(sim);
  if (sim.active('door')) { sim.key('Digit1', KEYS.ONE); sim.step(300); }
}

describe('полный забег (headless, GDD §10 — ворота MVP)', () => {
  for (const tier of [1, 2, 3]) {
    it(`Тир ${tier}: 30 комнат, 3 босса, все 8 врагов встречены, победа и Тир ${tier + 1} открыт`, async () => {
      localStorage.clear();
      sim = await Sim.create(`?tier=${tier}&seed=${100 + tier}`);
      sim.step(300);
      sim.key('Digit1', KEYS.ONE); // стартовая Руна
      const seen = new Set<string>();
      let bosses = 0;
      for (let room = 1; room <= 30; room++) {
        expect(sim.snap!.room, `комната ${room}`).toBe(room);
        if (room % 10 === 0) { (sim.game.scene.getScene('arena') as unknown as { player: { invulnUntil: number } }).player.invulnUntil = 1e12; sim.step(2500); if (sim.snap!.boss) bosses++; }
        clearRoom(sim, seen);
        expect(sim.snap!.dead, `смерть в комнате ${room}`).toBe(false);
      }
      expect(bosses).toBe(3);
      expect(sim.active('summary')).toBe(true);
      expect([...seen].sort()).toEqual(['bomber', 'boss_hammer', 'boss_lich', 'boss_warden', 'lancer', 'orbiter', 'rusher', 'shield', 'shooter', 'summoner', 'tank']);
      const s = sim.snap!;
      expect(s.kills).toBeGreaterThan(200);
      expect(s.gold).toBeGreaterThan(0);
      expect(s.echo).toBeGreaterThanOrEqual(150);
      expect(s.rank).toBeGreaterThanOrEqual(5);
    }, 120_000);
  }
});
