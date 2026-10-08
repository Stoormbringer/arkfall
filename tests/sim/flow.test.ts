// @vitest-environment jsdom
// @vitest-environment-options {"resources":"usable","pretendToBeVisual":true}
import { afterEach, describe, expect, it } from 'vitest';
import Phaser from 'phaser';
import { KEYS, killAll, passOverlays, Sim } from './harness';
import { Enemy } from '../../src/entities/Enemy';
import ENEMIES from '../../src/data/enemies.json';
import type { EnemyDef } from '../../src/data/types';

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
    passOverlays(sim);
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
      passOverlays(sim);
      expect(sim.active('door')).toBe(true);
      sim.key('Digit1', KEYS.ONE);
      sim.step(2800);
    }
    expect(sim.snap!.room).toBe(4);
  }, 60_000);
});

describe('смерть и босс (headless)', () => {
  it('смерть → итоги → Enter → хаб → Enter → новый забег со стартовой Руной', async () => {
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

describe('лут (headless)', () => {
  it('после босса предмет попадает в рюкзак, а после победы/смерти — в инвентарь', async () => {
    sim = await Sim.create('?tier=1&seed=42&room=10');
    sim.step(2800);
    killAll(sim);
    sim.step(1500);
    expect(sim.snap!.backpack.length).toBe(1);
    // смерть сразу: половина (из 1 — 1) едет домой
    const arena = sim.game.scene.getScene('arena') as unknown as { hitPlayer: (d: number, s: string) => void; player: { invulnUntil: number } };
    for (let i = 0; i < 5 && sim.active('facet'); i++) { sim.key('Digit1', KEYS.ONE); sim.step(400); }
    if (sim.active('door')) { sim.key('Digit1', KEYS.ONE); sim.step(2800); }
    arena.player.invulnUntil = 0; arena.hitPlayer(9999, 'тест');
    sim.step(2000);
    const inv = JSON.parse(localStorage.getItem('arkfall.progress.v1')!).inventory as string[];
    expect(inv.length).toBe(1);
  }, 30_000);
});

describe('пауза, снаряжение и сохранение (headless)', () => {
  it('Esc → меню → Q выход в хаб → сохранённый забег → Enter продолжает с той же комнаты', async () => {
    // без ?tier= — обычный режим с сохранениями; стартуем из хаба
    sim = await Sim.create('');
    sim.step(300);
    expect(sim.active('title')).toBe(true);
    sim.key('Enter', KEYS.ENTER); sim.step(400);
    sim.key('Digit1', KEYS.ONE); sim.step(2500);
    expect(sim.snap!.room).toBe(1);
    killAll(sim); sim.step(1500);
    passOverlays(sim);
    sim.key('Digit1', KEYS.ONE); sim.step(2800);
    expect(sim.snap!.room).toBe(2);
    sim.key('Escape', KEYS.ESC); sim.step(200);
    expect(sim.active('pause')).toBe(true);
    sim.key('KeyQ', 81); sim.step(400);
    expect(sim.active('title')).toBe(true);
    expect(localStorage.getItem('arkfall.run.v1')).not.toBeNull();
    sim.key('Enter', KEYS.ENTER); sim.step(3000);
    expect(sim.snap!.room).toBe(2);
    expect(sim.snap!.alive).toBeGreaterThan(0);
  }, 40_000);

  it('снаряжение из меню паузы меняет моды сразу', async () => {
    sim = await Sim.create('');
    sim.step(300); sim.key('Enter', KEYS.ENTER); sim.step(400); sim.key('Digit1', KEYS.ONE); sim.step(2500);
    const arena = sim.game.scene.getScene('arena') as unknown as { run: { equipped: Record<string, string>; rebuildMods: () => void; mods: { damageMult: number } } };
    const before = arena.run.mods.damageMult;
    sim.key('Escape', KEYS.ESC); sim.step(200);
    sim.key('KeyI', 73); sim.step(200);
    expect(sim.active('gear')).toBe(true);
    arena.run.equipped.weapon = 'jagged_blade'; arena.run.rebuildMods(); // как клик по карточке
    sim.key('Escape', KEYS.ESC); sim.step(300);
    expect(sim.active('gear')).toBe(false);
    expect(sim.paused('arena')).toBe(false);
    expect(arena.run.mods.damageMult).toBeCloseTo(before * 1.1);
  }, 30_000);
});

describe('золото и Торговец (headless)', () => {
  it('убийства дают золото; комната Торговца → после зачистки лавка (арена на паузе) → покупка → Esc → дверь', async () => {
    await startRun('?tier=1&seed=42');
    const arena = sim.game.scene.getScene('arena') as unknown as { run: { nextDoor: string | null; gold: number; backpack: string[]; addGold: (n: number) => void } };
    arena.run.nextDoor = 'shop'; // как будто игрок выбрал дверь «Торговец»
    expect(sim.snap!.gold).toBe(0);
    killAll(sim);
    sim.step(1500);
    expect(arena.run.gold).toBeGreaterThan(0);
    for (let i = 0; i < 5 && sim.active('facet'); i++) { sim.key('Digit1', KEYS.ONE); sim.step(400); }
    expect(sim.active('shop')).toBe(true);
    expect(sim.paused('arena')).toBe(true);
    expect(sim.active('door')).toBe(false);
    arena.run.addGold(1000);
    const before = arena.run.gold;
    sim.key('Digit1', KEYS.ONE); // купить первый предмет
    sim.step(100);
    expect(arena.run.backpack.length).toBe(1);
    expect(arena.run.gold).toBeLessThan(before);
    sim.key('Escape', KEYS.ESC);
    sim.step(400);
    expect(sim.active('shop')).toBe(false);
    expect(sim.active('door')).toBe(true);
    sim.key('Digit1', KEYS.ONE);
    sim.step(2800);
    expect(sim.snap!.room).toBe(2);
    expect(sim.snap!.alive).toBeGreaterThan(0);
  }, 30_000);
});

describe('Эхо и Лавка Ковчега (headless)', () => {
  it('босс даёт Эхо; после итогов оно в прогрессе; L в хабе открывает лавку, Esc возвращает', async () => {
    localStorage.clear(); // прогресс от прошлых тестов файла: иначе хаб уведёт в выбор скилла
    sim = await Sim.create('?tier=1&seed=42&room=30');
    sim.step(2800);
    killAll(sim);
    sim.step(1500);
    expect(sim.snap!.echo).toBe(60); // босс 3-го акта
    sim.key('Enter', KEYS.ENTER); sim.step(300);
    expect(sim.active('title')).toBe(true);
    expect(JSON.parse(localStorage.getItem('arkfall.progress.v1')!).echo).toBe(78); // 60 × 1,3 живым
    sim.key('KeyL', 76); sim.step(300);
    expect(sim.active('hubshop')).toBe(true);
    sim.key('Escape', KEYS.ESC); sim.step(300);
    expect(sim.active('title')).toBe(true);
  }, 30_000);
});

describe('новые враги (headless)', () => {
  type ArenaT = {
    enemies: Phaser.GameObjects.Group; player: { x: number; y: number; hp: number; invulnUntil: number };
    run: { tier: number; room: number };
    damageEnemy: (e: unknown, amount: number, from: Phaser.Math.Vector2, kb: number, src: string) => boolean;
  };
  const spawn = async (id: string, room: number) => {
    sim = await Sim.create(`?tier=1&seed=3&room=${room}`);
    sim.step(2800);
    const arena = sim.game.scene.getScene('arena') as unknown as ArenaT;
    killAll(sim); // комната пустеет и тут же получает нашего врага — до следующего кадра, чтобы не засчиталась зачистка
    const e = new Enemy(sim.game.scene.getScene('arena'), arena.player.x + 80, arena.player.y, id as never, (ENEMIES as Record<string, EnemyDef>)[id], 1, room);
    arena.enemies.add(e);
    return { arena, e };
  };

  it('акт 3: в комнате появляются новые типы', async () => {
    const seen = new Set<string>();
    for (const seed of [3, 4, 5]) {
      sim = await Sim.create(`?tier=1&seed=${seed}&room=21`);
      sim.step(2800);
      const arena = sim.game.scene.getScene('arena') as unknown as ArenaT;
      for (const e of arena.enemies.getChildren() as Enemy[]) seen.add(e.id);
      sim.destroy(); sim = undefined as unknown as Sim;
    }
    expect([...seen].filter((id) => ['bomber', 'lancer', 'summoner', 'shield', 'orbiter'].includes(id)).length).toBeGreaterThanOrEqual(2);
  }, 40_000);

  it('Подрывник: убитый взрывается после фитиля и ранит игрока рядом', async () => {
    const { arena, e } = await spawn('bomber', 2);
    arena.player.invulnUntil = 0;
    const hp = arena.player.hp;
    arena.damageEnemy(e, 9999, new Phaser.Math.Vector2(0, 0), 0, 'test');
    sim.step(100);
    expect(arena.player.hp).toBe(hp); // фитиль ещё горит
    sim.step(600);
    expect(arena.player.hp).toBeLessThan(hp);
  }, 30_000);

  it('Щитоносец: удар с фронта гасится, со спины — нет', async () => {
    const { arena, e } = await spawn('shield', 2);
    sim.step(50); // facing обновится на игрока (он слева)
    const hp0 = e.hp;
    arena.damageEnemy(e, 20, new Phaser.Math.Vector2(arena.player.x, arena.player.y), 0, 'test');
    const front = hp0 - e.hp;
    const hp1 = e.hp;
    arena.damageEnemy(e, 20, new Phaser.Math.Vector2(e.x + 200, e.y), 0, 'test');
    const back = hp1 - e.hp;
    expect(front).toBeCloseTo(20 * ENEMIES.shield.shield.frontDamageMult, 5);
    expect(back).toBe(20);
  }, 30_000);

  it('Копейщик: в фазе восстановления получает ×1,5 урона', async () => {
    const { arena, e } = await spawn('lancer', 2);
    e.phase = 'recover'; e.phaseUntil = 1e12;
    const hp0 = e.hp;
    arena.damageEnemy(e, 10, new Phaser.Math.Vector2(0, 0), 0, 'test');
    expect(hp0 - e.hp).toBeCloseTo(15, 5);
  }, 30_000);
});
