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

  it('I прямо из боя открывает снаряжение; Esc закрывает и возвращает бой', async () => {
    sim = await Sim.create('');
    sim.step(300); sim.key('Enter', KEYS.ENTER); sim.step(400); sim.key('Digit1', KEYS.ONE); sim.step(2500);
    sim.key('KeyI', 73); sim.step(200);
    expect(sim.active('gear')).toBe(true);
    expect(sim.paused('arena')).toBe(true);
    // снаряжение должно рисоваться НАД ареной и HUD (порядок сцен = порядок отрисовки)
    const order = sim.game.scene.getScenes(true).map((s) => s.scene.key);
    expect(order.indexOf('gear')).toBeGreaterThan(order.indexOf('hud'));
    sim.key('Escape', KEYS.ESC); sim.step(300);
    expect(sim.active('gear')).toBe(false);
    expect(sim.paused('arena')).toBe(false);
  }, 30_000);

  it('меню паузы: кнопка «Снаряжение» (клик) открывает экран, пауза уходит', async () => {
    sim = await Sim.create('');
    sim.step(300); sim.key('Enter', KEYS.ENTER); sim.step(400); sim.key('Digit1', KEYS.ONE); sim.step(2500);
    sim.key('Escape', KEYS.ESC); sim.step(200);
    expect(sim.active('pause')).toBe(true);
    const pause = sim.game.scene.getScene('pause') as unknown as { actions: Record<string, () => void> };
    pause.actions.I(); // как клик по кнопке
    sim.step(200);
    expect(sim.active('pause')).toBe(false);
    expect(sim.active('gear')).toBe(true);
  }, 30_000);

  it('меню паузы → O → настройки поверх арены → Esc → бой продолжается', async () => {
    sim = await Sim.create('');
    sim.step(300); sim.key('Enter', KEYS.ENTER); sim.step(400); sim.key('Digit1', KEYS.ONE); sim.step(2500);
    sim.key('Escape', KEYS.ESC); sim.step(200);
    sim.key('KeyO', 79); sim.step(200);
    expect(sim.active('settings')).toBe(true);
    expect(sim.active('pause')).toBe(false);
    const order = sim.game.scene.getScenes(true).map((s) => s.scene.key);
    expect(order.indexOf('settings')).toBeGreaterThan(order.indexOf('hud'));
    sim.key('Digit1', KEYS.ONE); sim.step(50); // тряска выкл
    expect(JSON.parse(localStorage.getItem('arkfall.settings.v1')!).shake).toBe(false);
    sim.key('Escape', KEYS.ESC); sim.step(300);
    expect(sim.active('settings')).toBe(false);
    expect(sim.paused('arena')).toBe(false);
  }, 30_000);

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

  it('Подрывник: подбегает и самоподрывается без ошибки, ранит игрока, убийство не засчитывается', async () => {
    const { arena, e } = await spawn('bomber', 2);
    arena.player.invulnUntil = 0;
    const run = (arena as unknown as { run: { kills: number } }).run;
    const hp = arena.player.hp, kills = run.kills;
    sim.step(1500); // в 80 px от игрока — замах 0,7 с и взрыв
    expect(e.active).toBe(false);
    expect(arena.player.hp).toBeLessThan(hp);
    expect(run.kills).toBe(kills);
  }, 30_000);

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

describe('скиллы пакета 28 (headless)', () => {
  type ArenaT = {
    enemies: Phaser.GameObjects.Group; player: { x: number; y: number; hp: number; invulnUntil: number; riposteUntil: number; dodgeUntil: number; rhythmStacks: number };
    skills: { id: string; tryCast: (aim: Phaser.Math.Vector2) => void }[];
    run: { mods: { shardShot: { bounces: number } } };
    hitPlayer: (d: number, s: string) => void;
    damageEnemy: (e: unknown, amount: number, from: Phaser.Math.Vector2, kb: number, src: string) => boolean;
  };
  const setup = async (skills: string, enemyId = 'tank') => {
    sim = await Sim.create(`?tier=1&seed=3&room=2&skills=${skills}`);
    sim.step(2800);
    const arena = sim.game.scene.getScene('arena') as unknown as ArenaT;
    killAll(sim);
    const e = new Enemy(sim.game.scene.getScene('arena'), arena.player.x + 60, arena.player.y, enemyId as never, (ENEMIES as Record<string, EnemyDef>)[enemyId], 1, 2);
    arena.enemies.add(e);
    return { arena, e };
  };

  it('Эхо-удар: замах, затем урон и оглушение всех рядом', async () => {
    const { arena, e } = await setup('echo_strike');
    const hp = e.hp;
    arena.skills.find((s) => s.id === 'echo_strike')!.tryCast(new Phaser.Math.Vector2(e.x, e.y));
    sim.step(200);
    expect(e.hp).toBe(hp); // ещё замах
    sim.step(500);
    expect(e.hp).toBeLessThan(hp);
    expect(e.phase).toBe('stunned');
  }, 30_000);

  it('Призрачный клинок: кружит и бьёт ближайшего', async () => {
    const { arena, e } = await setup('phantom_blade');
    const hp = e.hp;
    arena.skills.find((s) => s.id === 'phantom_blade')!.tryCast(new Phaser.Math.Vector2(0, 0));
    sim.step(1500);
    expect(e.hp).toBeLessThan(hp);
    expect(sim.snap!.skills.find((s) => s.name === 'Призрачный клинок')!.ready01).toBe(1);
  }, 30_000);

  it('Жало ответа: удар в кадры уклонения — парирование заряжает окно', async () => {
    const { arena } = await setup('riposte');
    expect(arena.player.riposteUntil).toBe(0);
    arena.player.invulnUntil = 0;
    arena.hitPlayer(5, 'тест'); // обычный удар — не парирование
    expect(arena.player.riposteUntil).toBe(0);
    arena.player.dodgeUntil = 1e12; arena.player.invulnUntil = 1e12;
    arena.hitPlayer(5, 'тест');
    expect(arena.player.riposteUntil).toBeGreaterThan(0);
  }, 30_000);

  it('Ядовитая почва: враг в зоне получает яд, который тикает после', async () => {
    const { arena, e } = await setup('spike_ground');
    const run = (arena as unknown as { run: { takeFacet: (id: string) => void } }).run;
    run.takeFacet('poison_soil');
    arena.skills.find((s) => s.id === 'spike_ground')!.tryCast(new Phaser.Math.Vector2(e.x, e.y));
    sim.step(300);
    expect(e.poisonUntil).toBeGreaterThan(0);
    expect(e.lastHitBy).toBe('Шипастая земля');
    sim.step(4500); // зона 4 с кончилась, яд ещё 3 с
    expect(e.lastHitBy).toBe('Яд');
  }, 30_000);
});

describe('формы комнат (headless)', () => {
  it('«Коридор»: герой за стеной, враги обходят препятствие и доходят до дистанции удара', async () => {
    sim = await Sim.create('?tier=1&seed=3&room=2&layout=3');
    sim.step(2800);
    type ArenaT = { enemies: Phaser.GameObjects.Group; player: { x: number; y: number; invulnUntil: number; setPosition: (x: number, y: number) => void } };
    const arena = sim.game.scene.getScene('arena') as unknown as ArenaT;
    arena.player.setPosition(640, 360); arena.player.invulnUntil = 1e12; // между двумя стенами коридора
    expect(sim.snap!.layout).toBe('Коридор');
    sim.step(6000);
    const near = (arena.enemies.getChildren() as Enemy[]).filter((e) => e.active && Phaser.Math.Distance.Between(e.x, e.y, 640, 360) < 160);
    expect(near.length).toBeGreaterThan(0);
  }, 30_000);

  it('никто не появляется внутри колонны ни в одной из 12 форм', async () => {
    for (let layout = 1; layout < 12; layout++) {
      sim = await Sim.create(`?tier=1&seed=9&room=25&layout=${layout}`);
      sim.step(2800);
      const arena = sim.game.scene.getScene('arena') as unknown as { enemies: Phaser.GameObjects.Group; grid: { blocksWalk: (x: number, y: number) => boolean } };
      for (const e of arena.enemies.getChildren() as Enemy[]) expect(arena.grid.blocksWalk(e.x, e.y), `форма ${layout} ${e.id}`).toBe(false);
      sim.destroy(); sim = undefined as unknown as Sim;
    }
  }, 60_000);
});

describe('боссы актов 2–3 (headless)', () => {
  type ArenaT = { enemies: Phaser.GameObjects.Group; player: { x: number; y: number; invulnUntil: number; setPosition: (x: number, y: number) => void }; damageEnemy: (e: unknown, amount: number, from: Phaser.Math.Vector2, kb: number, src: string) => boolean };

  it('комната 20 — Костяной жрец: держит дистанцию, после 4 вееров зовёт скелетов; фаза 2 — телепорт от героя', async () => {
    sim = await Sim.create('?tier=1&seed=42&room=20');
    sim.step(2800);
    expect(sim.snap!.boss?.name).toBe('Костяной жрец');
    const arena = sim.game.scene.getScene('arena') as unknown as ArenaT;
    arena.player.invulnUntil = 1e12;
    const boss = (arena.enemies.getChildren() as Enemy[]).find((e) => e.isBoss)!;
    sim.step(12_000);
    const ids = (arena.enemies.getChildren() as Enemy[]).map((e) => e.id);
    expect(ids.filter((id) => id === 'lancer').length).toBeGreaterThanOrEqual(2);
    // фаза 2: встаём вплотную — лич уходит
    arena.damageEnemy(boss, boss.maxHp * 0.55, new Phaser.Math.Vector2(0, 0), 0, 'test');
    sim.step(100);
    arena.player.setPosition(boss.x + 40, boss.y);
    sim.step(600);
    expect(Phaser.Math.Distance.Between(arena.player.x, arena.player.y, boss.x, boss.y)).toBeGreaterThan(200);
    expect(sim.snap!.boss?.phase).toBe(2);
  }, 40_000);

  it('комната 30 — Страж Бездны: рывок, уязвим после; фаза 2 — кольцо снарядов', async () => {
    sim = await Sim.create('?tier=1&seed=42&room=30');
    sim.step(2800);
    expect(sim.snap!.boss?.name).toBe('Страж Бездны');
    const arena = sim.game.scene.getScene('arena') as unknown as ArenaT & { bullets: Phaser.Physics.Arcade.Group };
    arena.player.invulnUntil = 1e12;
    const boss = (arena.enemies.getChildren() as Enemy[]).find((e) => e.isBoss)!;
    let sawVuln = false;
    for (let i = 0; i < 60 && !sawVuln; i++) { sim.step(100); if (boss.isVulnerable) sawVuln = true; }
    expect(sawVuln).toBe(true);
    arena.damageEnemy(boss, boss.maxHp * 0.55, new Phaser.Math.Vector2(0, 0), 0, 'test');
    sim.step(5000);
    expect(sim.snap!.boss?.phase).toBe(2);
    expect(arena.bullets.countActive(true)).toBeGreaterThan(0);
  }, 40_000);
});

describe('прогрессия героя (headless)', () => {
  it('?level=21: удар клинка сильнее, чем на 1-м уровне, и HP больше', async () => {
    sim = await Sim.create('?tier=1&seed=3&room=2&level=1');
    const hp1 = sim.snap!.maxHp, d1 = (sim.game.scene.getScene('arena') as unknown as { run: { mods: { damageMult: number } } }).run.mods.damageMult;
    sim.destroy();
    sim = await Sim.create('?tier=1&seed=3&room=2&level=21');
    expect(sim.snap!.maxHp).toBeGreaterThan(hp1);
    expect((sim.game.scene.getScene('arena') as unknown as { run: { mods: { damageMult: number } } }).run.mods.damageMult).toBeGreaterThan(d1 * 1.2);
  }, 30_000);

  it('хаб → U → экран прокачки → Esc', async () => {
    sim = await Sim.create('');
    sim.step(300);
    sim.key('KeyU', 85); sim.step(300);
    expect(sim.active('upgrade')).toBe(true);
    sim.key('Escape', KEYS.ESC); sim.step(300);
    expect(sim.active('title')).toBe(true);
  }, 30_000);
});

describe('препятствия и анимация атак (headless)', () => {
  it('враг, заброшенный внутрь колонны, выталкивается на свободную клетку', async () => {
    sim = await Sim.create('?tier=1&seed=3&room=2&layout=1');
    sim.step(2800);
    const arena = sim.game.scene.getScene('arena') as unknown as { enemies: Phaser.GameObjects.Group; grid: { blocksWalk: (x: number, y: number) => boolean; obstacles: () => { cx: number; cy: number }[] } };
    const e = (arena.enemies.getChildren() as Enemy[])[0];
    const p = arena.grid.obstacles()[0];
    e.setPosition(p.cx * 40 + 20, p.cy * 40 + 20);
    expect(arena.grid.blocksWalk(e.x, e.y)).toBe(true);
    sim.step(50);
    expect(arena.grid.blocksWalk(e.x, e.y)).toBe(false);
  }, 30_000);

  it('замах и удар меняют форму врага (анимация атаки), после — масштаб восстанавливается', async () => {
    sim = await Sim.create('?tier=1&seed=3&room=2');
    sim.step(2800);
    const arena = sim.game.scene.getScene('arena') as unknown as { enemies: Phaser.GameObjects.Group; player: { x: number; y: number; invulnUntil: number } };
    arena.player.invulnUntil = 1e12;
    killAll(sim);
    const e = new Enemy(sim.game.scene.getScene('arena'), arena.player.x + 60, arena.player.y, 'tank', ENEMIES.tank as EnemyDef, 1, 2);
    arena.enemies.add(e);
    const k = e.baseScale;
    let sawWind = false, sawStrike = false;
    for (let i = 0; i < 40; i++) {
      sim.step(50);
      if (e.phase === 'windup' && e.scaleX < k * 0.99) sawWind = true;
      if (e.phase === 'strike' && e.scaleX > k * 1.05) sawStrike = true;
    }
    expect(sawWind).toBe(true); expect(sawStrike).toBe(true);
    sim.step(2000);
    expect(e.scaleX).toBeCloseTo(k, 1);
  }, 30_000);
});
