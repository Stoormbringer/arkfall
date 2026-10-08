import Phaser from 'phaser';
import { ArenaScene, type ArenaSnapshot } from '../../src/scenes/ArenaScene';
import { BootScene } from '../../src/scenes/BootScene';
import { DoorScene } from '../../src/scenes/DoorScene';
import { FacetScene } from '../../src/scenes/FacetScene';
import { GearScene } from '../../src/scenes/GearScene';
import { ShopScene } from '../../src/scenes/ShopScene';
import { HubShopScene } from '../../src/scenes/HubShopScene';
import { SettingsScene } from '../../src/scenes/SettingsScene';
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
      // Порядок = порядок отрисовки: оверлеи поверх арены и HUD идут ПОСЛЕ них, иначе launch() рисует их под ареной
  scene: [BootScene, TitleScene, SkillChoiceScene, ArenaScene, HudScene, FacetScene, DoorScene, PauseScene, GearScene, SummaryScene, ShopScene, HubShopScene, SettingsScene],
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
  /** Phaser откладывает уничтожение до следующего кадра — в ручном режиме доводим его до конца сразу */
  destroy() {
    this.game.destroy(true);
    (this.game as unknown as { runDestroy: () => void }).runDestroy();
  }
}
const dt = () => 1000 / 60;
export const KEYS = { ONE: 49, TWO: 50, THREE: 51, ENTER: 13, R: 82, P: 80, ESC: 27 };

/** Закрыть накопленные выборы Рун и лавку Торговца (если открылась) — до двери */
export function passOverlays(sim: Sim) {
  for (let i = 0; i < 5 && sim.active('facet'); i++) { sim.key('Digit1', KEYS.ONE); sim.step(400); }
  if (sim.active('shop')) { sim.key('Escape', KEYS.ESC); sim.step(400); }
}

/** Убить всех живых врагов через единую точку урона арены (как будто игрок всех ударил) */
export function killAll(sim: Sim) {
  const arena = sim.game.scene.getScene('arena') as unknown as {
    enemies: Phaser.GameObjects.Group;
    damageEnemy: (e: unknown, amount: number, from: Phaser.Math.Vector2, kb: number, src: string) => boolean;
  };
  for (const e of [...arena.enemies.getChildren()]) arena.damageEnemy(e, 99_999, new Phaser.Math.Vector2(0, 0), 0, 'test');
}
