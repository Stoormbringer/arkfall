import Phaser from 'phaser';
import { ArenaScene, type ArenaSnapshot } from '../../src/scenes/ArenaScene';
import { BootScene } from '../../src/scenes/BootScene';
import { DoorScene } from '../../src/scenes/DoorScene';
import { FacetScene } from '../../src/scenes/FacetScene';
import { HudScene } from '../../src/scenes/HudScene';
import { PauseScene } from '../../src/scenes/PauseScene';
import { SkillChoiceScene } from '../../src/scenes/SkillChoiceScene';
import { SummaryScene } from '../../src/scenes/SummaryScene';
import { TitleScene } from '../../src/scenes/TitleScene';

/** Headless-игра под Node: шаги времени задаются вручную, детерминированно. */
export class Sim {
  game!: Phaser.Game;
  private t = 0;

  static async create(search = '?tier=1&seed=42'): Promise<Sim> {
    window.history.replaceState({}, '', '/' + search);
    const sim = new Sim();
    // Phaser TweenManager идёт по Date.now() — привязываем его к времени симуляции
    const base = Date.now();
    Date.now = () => base + sim.t;
    sim.game = new Phaser.Game({
      type: Phaser.HEADLESS, width: 1280, height: 720, parent: undefined,
      audio: { noAudio: true },
      physics: { default: 'arcade' },
      scene: [BootScene, TitleScene, SkillChoiceScene, ArenaScene, HudScene, FacetScene, DoorScene, PauseScene, SummaryScene],
    });
    await new Promise<void>((res) => sim.game.events.once('ready', () => res()));
    sim.game.loop.stop();
    sim.step(1);
    return sim;
  }

  /** Продвинуть игру на ms миллисекунд кадрами по 16,7 мс */
  step(ms: number) {
    const dt = 1000 / 60;
    for (let left = ms; left > 0; left -= dt) { this.t += dt; this.game.headlessStep(this.t, dt); }
  }

  key(code: string, keyCode: number) {
    for (const type of ['keydown', 'keyup']) {
      const ev = new KeyboardEvent(type, { code, key: code, bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'keyCode', { get: () => keyCode });
      window.dispatchEvent(ev);
      this.step(dt());
    }
  }

  get snap(): ArenaSnapshot | undefined { return (globalThis as unknown as { __arkfall?: ArenaSnapshot }).__arkfall; }
  active(key: string) { return this.game.scene.isActive(key); }
  paused(key: string) { return this.game.scene.isPaused(key); }
  destroy() { this.game.destroy(true); }
}
const dt = () => 1000 / 60;
export const KEYS = { ONE: 49, TWO: 50, THREE: 51, ENTER: 13, R: 82, P: 80, ESC: 27 };

/** Убить всех живых врагов через единую точку урона арены (как будто игрок всех ударил) */
export function killAll(sim: Sim) {
  const arena = sim.game.scene.getScene('arena') as unknown as {
    enemies: Phaser.GameObjects.Group;
    damageEnemy: (e: unknown, amount: number, from: Phaser.Math.Vector2, kb: number, src: string) => boolean;
  };
  for (const e of [...arena.enemies.getChildren()]) arena.damageEnemy(e, 99_999, new Phaser.Math.Vector2(0, 0), 0, 'test');
}
