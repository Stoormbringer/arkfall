import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import ROOMS from '../data/rooms.json';
import F from '../data/formulas.json';
import type { EnemyDef, EnemyId } from '../data/types';
import { enemyCount, xpBoss, xpMob } from '../core/formulas';
import { Rng } from '../core/rng';
import { Enemy } from '../entities/Enemy';
import { Boss } from '../entities/Boss';
import { loadProgress, recordRun } from '../meta/Progress';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { RunState } from '../run/RunState';
import { offerFacets, offerStartFacets } from '../run/facetOffer';
import { DOORS, ELITE_ROOM, HEAL_DOOR_HP, offerDoors, SHARDS_DOOR_BONUS, type DoorReward } from '../run/doors';
import { ITEMS, keepOnDeath, rollItem } from '../run/loot';
import { goldForBoss, goldForEliteRoom, goldForMob, Shop } from '../run/shop';
import { echoForBoss, echoForEliteRoom, echoRunTotal } from '../meta/echo';
import { assignKeys, Barrier, createSkill, type Battlefield, type Skill, type SkillView } from '../skills/skills';
import { loadProgress as loadP } from '../meta/Progress';
import { clearRun, saveRun } from '../meta/RunSave';

export interface ArenaSnapshot {
  act: number; roomInAct: number; roomsPerAct: number; acts: number;
  boss: { name: string; hp01: number; phase: number } | null;
  roomTag: string;
  paused: boolean;
  lastError: string;
  tier: number; room: number; seed: number; kills: number; alive: number;
  cleared: boolean; dead: boolean; killer: string;
  hp: number; maxHp: number; dodgeCharges: number; dodgeMax: number; dodge01: number;
  rhythm: number; rank: number; shards: number; nextRankAt: number; gold: number; echo: number;
  skills: SkillView[]; facets: string[]; xp: number; hasRhythm: boolean; backpack: string[]; toast: string;
  ttkSamples: { role: string; sec: number; hits: number }[];
}

interface Zone { x: number; y: number; r: number; until: number; nextTick: number; dps: number; tickSec: number; slow: number; gfx: Phaser.GameObjects.Arc }
interface PlayerBullet extends Projectile { onHit?: (e: Enemy, x: number, y: number) => void }

const ROOM = ROOMS.arena;
const RUN = ROOMS.run;

export class ArenaScene extends Phaser.Scene {
  run!: RunState;
  private player!: Player;
  private enemies!: Phaser.GameObjects.Group;
  private bullets!: Phaser.Physics.Arcade.Group;
  private playerBullets!: Phaser.Physics.Arcade.Group;
  private rng!: Rng;
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'LEFT' | 'DOWN' | 'RIGHT' | 'SPACE' | 'SHIFT' | 'R' | 'Q' | 'E' | 'F' | 'P' | 'ESC', Phaser.Input.Keyboard.Key>;
  private skills: Skill[] = [];
  private zones: Zone[] = [];
  private advancing = false;
  private pendingSpawns = 0;
  private cleared = false;
  private dead = false;
  private killer = '';
  private choosing = false;
  private currentOffer: string[] = [];
  private overlaySince = 0;
  private overlayData: { key: 'facet' | 'door' | 'shop'; data: object } | null = null;
  private doorPending = false;
  private shopPending = false;
  private shop: Shop | null = null;
  private waveStarted = false;
  private toast = '';
  private boss: Boss | null = null;
  private finished = false;

  constructor() { super('arena'); }

  init(data: { run?: RunState }) {
    if (data.run) this.run = data.run;
    else {
      const q = new URLSearchParams(location.search);
      const p = loadP();
      const skills = q.get('skills')?.split(',') ?? p.skills; // ?skills=dash_cut,spark — для тестов
      this.run = new RunState(Number(q.get('tier') ?? 1), Number(q.get('seed') ?? Date.now() % 1_000_000), skills, p.equipped);
      this.run.room = Number(q.get('room') ?? 1);
    }
    this.rng = new Rng(this.run.seed * 31 + this.run.room);
    this.advancing = false; this.pendingSpawns = 0; this.cleared = false; this.dead = false; this.killer = ''; this.choosing = false;
    this.zones = [];
    this.boss = null; this.finished = false; this.doorPending = false; this.waveStarted = false; this.shopPending = false; this.shop = null;
  }

  get isEliteRoom() { return this.run.nextDoor === 'elite'; }

  /** Прямой вход по URL — тестовый режим, не трогаем сохранения */
  get isTestRun() { return new URLSearchParams(location.search).has('tier'); }

  get isBossRoom() { return this.run.room % RUN.roomsPerAct === 0; }
  get isLastRoom() { return this.run.room >= RUN.acts * RUN.roomsPerAct; }

  create() {
    try { this.createInner(); } catch (err) {
      (globalThis as unknown as { __arkfallError?: string }).__arkfallError = `ArenaScene.create: ${(err as Error).message}`;
      throw err;
    }
  }

  private createInner() {
    if (!this.scene.isActive('hud')) this.scene.launch('hud');
    const { width, height, wall } = ROOM;
    this.physics.world.setBounds(wall, wall, width - wall * 2, height - wall * 2);
    // Пол: сетка графикой, без TileSprite (он берёт холст из пула и ломается после scene.stop)
    const floor = this.add.graphics().setDepth(0);
    floor.fillStyle(0x161a23, 1).fillRect(0, 0, width, height);
    floor.lineStyle(1, 0x1f2430, 1);
    for (let x = 0; x <= width; x += 64) floor.lineBetween(x, 0, x, height);
    for (let y = 0; y <= height; y += 64) floor.lineBetween(0, y, width, y);
    this.add.rectangle(width / 2, height / 2, width - wall * 2, height - wall * 2).setStrokeStyle(3, 0x2d3444).setDepth(1);

    this.player = new Player(this, width / 2, height / 2, this.run.mods, this.run.hp ?? undefined);
    this.player.hasRhythm = this.run.skills.includes('blood_rhythm');
    this.enemies = this.add.group();
    this.bullets = this.physics.add.group({ classType: Projectile, maxSize: 200 });
    this.playerBullets = this.physics.add.group({ classType: Projectile, maxSize: 200 });

    const field: Battlefield = {
      enemies: () => this.enemies.getChildren() as Enemy[],
      damage: (e, amount, from, kb, source) => this.damageEnemy(e, amount, from, kb, source),
      addZone: (x, y, r, dur, dps, tick, slow) => this.addZone(x, y, r, dur, dps, tick, slow ?? 1),
      shootPlayer: (x, y, a, sp, d, onHit) => {
        const b = this.playerBullets.get(x, y) as PlayerBullet | null;
        if (!b) return;
        b.fire(x, y, a, sp, d, 'player');
        b.setTint(0xf5f1e6);
        b.onHit = onHit;
      },
    };
    this.skills = [];
    for (const id of this.run.skills) { const s = createSkill(id, this, this.player, this.run.mods, field); if (s) this.skills.push(s); }
    assignKeys(this.skills);

    this.physics.add.overlap(this.playerBullets, this.enemies, (a, b) => {
      // порядок аргументов у Phaser не гарантирован — определяем по типу
      const bullet = (a instanceof Projectile ? a : b) as PlayerBullet;
      const e = (a instanceof Enemy ? a : b) as Enemy;
      if (!(bullet instanceof Projectile) || !(e instanceof Enemy) || !bullet.active || !e.active) return;
      const x = bullet.x, y = bullet.y, cb = bullet.onHit;
      bullet.onHit = undefined;
      bullet.kill();
      this.damageEnemy(e, bullet.damage, new Phaser.Math.Vector2(this.player.x, this.player.y), 60, 'Осколочный выстрел');
      cb?.(e, x, y);
    });

    this.physics.add.overlap(this.player, this.bullets, (a, b) => {
      const bullet = (a instanceof Projectile ? a : b) as Projectile;
      if (!(bullet instanceof Projectile) || !bullet.active) return;
      bullet.kill();
      this.hitPlayer(bullet.damage, bullet.source);
    });
    this.physics.add.collider(this.enemies, this.enemies);

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT,SPACE,SHIFT,R,Q,E,F,P,ESC') as typeof this.keys;
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown() && !this.dead && !this.choosing) this.skills.find((s) => s.id === 'dash_cut')?.tryCast(new Phaser.Math.Vector2(p.worldX, p.worldY));
    });

    const onChosen = (id: string) => this.onFacetChosen(id);
    const onReroll = () => this.onFacetReroll();
    const onResume = () => { this.scene.resume(); this.emit(); };
    const onDoor = (r: DoorReward) => this.onDoorChosen(r);
    const onGear = () => { this.scene.launch('gear', { run: this.run }); };
    const onGearClosed = () => { this.applyModsToPlayer(); this.scene.resume(); this.emit(); };
    const onExit = () => this.exitToHub();
    const onShopHeal = (hp: number) => { this.player.heal(hp); this.run.hp = this.player.hp; this.emit(); };
    const onShopClosed = () => this.onShopClosed();
    this.game.events.on('facet-chosen', onChosen).on('facet-reroll', onReroll).on('resume-arena', onResume).on('door-chosen', onDoor)
      .on('open-gear', onGear).on('gear-closed', onGearClosed).on('exit-to-hub', onExit).on('shop-heal', onShopHeal).on('shop-closed', onShopClosed);
    this.events.once('shutdown', () => this.game.events.off('facet-chosen', onChosen).off('facet-reroll', onReroll).off('resume-arena', onResume).off('door-chosen', onDoor)
      .off('open-gear', onGear).off('gear-closed', onGearClosed).off('exit-to-hub', onExit).off('shop-heal', onShopHeal).off('shop-closed', onShopClosed));

    // Контрольная точка: начало каждой комнаты (GDD §5.5)
    if (!this.isTestRun) saveRun(this.run.toSave());

    // Эффект двери «Передышка» — на входе
    if (this.run.nextDoor === 'heal') this.player.heal(HEAL_DOOR_HP);
    this.events.on('resume', () => this.emit());

    if (this.run.room === 1 && !this.run.startOfferDone) {
      // стартовая Руна: первая развилка на 0-й секунде
      this.run.startOfferDone = true;
      this.choosing = true;
      this.currentOffer = offerStartFacets(this.rng);
      this.openOverlay('facet', { offer: this.currentOffer, rerollsLeft: 0, rank: 0, title: 'Стартовая Руна — с чем ныряем?' });
      this.emit();
      return;
    }
    this.roomIntro(() => this.spawnWave());
    this.emit();
  }

  /** Короткий вход в комнату: подпись, затем телеграфы появления */
  private roomIntro(then: () => void) {
    const tag = this.run.nextDoor && this.run.nextDoor !== 'boss' ? ` · ${DOORS[this.run.nextDoor].name}` : this.isBossRoom ? ' · Логово' : '';
    const t = this.add.text(ROOM.width / 2, ROOM.height / 2 - 40, `Акт ${Math.ceil(this.run.room / RUN.roomsPerAct)} · Комната ${((this.run.room - 1) % RUN.roomsPerAct) + 1}${tag}`, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '22px', color: '#9aa4b8' }).setOrigin(0.5).setDepth(20).setAlpha(0);
    this.tweens.add({ targets: t, alpha: { from: 0, to: 1 }, duration: 200, yoyo: true, hold: 900, onComplete: () => t.destroy() });
    // На время входа держим «ожидающее появление», чтобы комната не считалась пройденной
    this.pendingSpawns++;
    this.time.delayedCall(ROOM.introDelaySec * 1000, () => { this.pendingSpawns--; then(); });
  }

  update(_t: number, deltaMs: number) {
    if (this.dead || this.finished) return;
    if (this.choosing || this.doorPending || this.shopPending) {
      // сторож: оверлей запрошен, но так и не появился (и арена не на паузе) — перезапускаем именно его
      const o = this.overlayData;
      if (o && !this.scene.isActive(o.key) && !this.scene.isPaused() && this.time.now - this.overlaySince > 1000) {
        this.overlaySince = this.time.now;
        this.scene.launch(o.key, o.data);
        this.scene.pause();
      }
      return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.P) || Phaser.Input.Keyboard.JustDown(this.keys.ESC)) {
      this.scene.pause();
      this.scene.launch('pause');
      this.emit(true);
      return;
    }

    const move = new Phaser.Math.Vector2(
      (this.keys.D.isDown || this.keys.RIGHT.isDown ? 1 : 0) - (this.keys.A.isDown || this.keys.LEFT.isDown ? 1 : 0),
      (this.keys.S.isDown || this.keys.DOWN.isDown ? 1 : 0) - (this.keys.W.isDown || this.keys.UP.isDown ? 1 : 0),
    ).normalize();
    const ptr = this.input.activePointer;
    const aim = new Phaser.Math.Vector2(ptr.worldX, ptr.worldY);
    const dodge = Phaser.Input.Keyboard.JustDown(this.keys.SPACE) || Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
    const locked = this.skills.some((s) => s.locksControl);

    const strike = this.player.handleInput({ move, aim, attack: ptr.leftButtonDown(), dodge }, locked);
    if (strike) this.resolveMelee(strike);
    this.player.regen(deltaMs / 1000);
    for (const k of ['Q', 'E', 'R', 'F'] as const)
      if (Phaser.Input.Keyboard.JustDown(this.keys[k])) this.skills.find((s) => s.key === k)?.tryCast(aim);
    for (const s of this.skills) s.update(deltaMs / 1000);
    this.updateZones();

    const ctx = {
      player: this.player,
      shoot: (x: number, y: number, a: number, sp: number, d: number, src: string) => (this.bullets.get(x, y) as Projectile | null)?.fire(x, y, a, sp, d, src),
      hitPlayer: (d: number, src: string) => this.hitPlayer(d, src),
      aliveCount: () => this.enemies.countActive(true) + this.pendingSpawns,
      blast: (x: number, y: number, r: number, d: number, src: string) => this.blast(x, y, r, d, src),
      spawnAdd: (x: number, y: number, id: 'rusher' | 'shooter') => {
        this.pendingSpawns++;
        this.telegraphSpawn(new Phaser.Math.Vector2(x, y), () => { this.pendingSpawns--; this.enemies.add(new Enemy(this, x, y, id, ENEMIES[id] as EnemyDef, this.run.tier, this.run.room)); });
      },
    };
    for (const e of this.enemies.getChildren() as Enemy[]) e.update(ctx);

    const alive = this.enemies.countActive(true);
    if (this.waveStarted && alive === 0 && this.pendingSpawns === 0 && !this.advancing) this.onRoomCleared();
    this.emit();
  }

  // ---------- урон ----------

  /** Единая точка урона по врагу: модификаторы, добивание, TTK, Осколки, лечение за убийство */
  private damageEnemy(e: Enemy, amount: number, from: Phaser.Math.Vector2, knockback: number, source: string): boolean {
    if (!e.active) return false;
    e.lastHitBy = source;
    // Щитоносец: урон с фронта гасится; Копейщик после рывка уязвим
    if (e.def.shield) {
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(e.x, e.y, from.x, from.y) - e.facing));
      if (diff <= Phaser.Math.DegToRad(e.def.shield.frontArcDeg) / 2) { amount *= e.def.shield.frontDamageMult; this.floatText(e.x, e.y - 20, 'щит', '#dfe8e6'); }
    }
    if (e.isVulnerable) amount *= e.def.recoverVulnMult!;
    const dealt = Math.min(amount, Math.max(0, e.hp));
    let killed = e.takeDamage(amount, from, knockback);
    if (this.run.mods.lifesteal > 0 && source === 'Дуговой клинок') this.player.heal(dealt * this.run.mods.lifesteal);
    if (!killed && this.run.mods.executeBelow > 0 && e.hp / e.maxHp < this.run.mods.executeBelow) { e.die(); killed = true; }
    if (killed) {
      if (e.def.attack.kind === 'explode' && !e.detonated) this.delayedBlast(e.x, e.y, e.def.attack.aoeRadius, e.dmg, e.def.name, e.def.attack.deathFuseSec * 1000);
      this.run.kills++;
      this.run.xp += Math.round((e.isBoss ? xpBoss(this.run.tier, this.run.room) : xpMob(this.run.tier, this.run.room)) * this.run.mods.xpMult);
      if (e.firstHitAt !== null && !e.isBoss) this.run.ttkSamples.push({ role: e.id, sec: (this.time.now - e.firstHitAt) / 1000, hits: e.hitsTaken });
      this.run.addShards(e.isBoss ? F.shards.boss : F.shards.mob);
      if (e.isBoss) { this.boss = null; this.run.addEcho(echoForBoss(Math.ceil(this.run.room / RUN.roomsPerAct), this.run.tier)); }
      if (this.run.mods.healPerKill) this.player.heal(this.run.mods.healPerKill);
      // Золото (GDD §8.2): падает сразу в кошелёк забега, без подбора с пола
      const gold = e.isBoss ? goldForBoss(this.run.tier) : goldForMob(this.rng, this.run.tier, this.run.room);
      this.run.addGold(gold);
      this.floatText(e.x, e.y - 14, `+${gold}`, '#f0c75e');
    }
    return killed;
  }

  /** Взрыв: вспышка, урон игроку в радиусе */
  private blast(x: number, y: number, r: number, dmg: number, source: string) {
    const flash = this.add.circle(x, y, r, 0xff8a3c, 0.5).setDepth(6);
    this.tweens.add({ targets: flash, alpha: 0, scale: 1.15, duration: 220, onComplete: () => flash.destroy() });
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= r + 10) this.hitPlayer(dmg, source);
  }

  /** Посмертный взрыв Подрывника: фитиль с телеграфом, потом взрыв (§6.7 — всё телеграфируется) */
  private delayedBlast(x: number, y: number, r: number, dmg: number, source: string, fuseMs: number) {
    const ring = this.add.circle(x, y, r, 0xff8a3c, 0.1).setStrokeStyle(2, 0xff8a3c, 0.9).setDepth(5);
    this.tweens.add({ targets: ring, fillAlpha: 0.4, duration: fuseMs, onComplete: () => { ring.destroy(); if (!this.dead && !this.finished) this.blast(x, y, r, dmg, source); } });
  }

  /** Всплывающая цифра над точкой (золото, позже — урон) */
  private floatText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '13px', color }).setOrigin(0.5).setDepth(15);
    this.tweens.add({ targets: t, y: y - 28, alpha: 0, duration: 700, ease: 'Quad.Out', onComplete: () => t.destroy() });
  }

  private resolveMelee(s: { angle: number; radius: number; arcRad: number; damage: number; knockback: number }) {
    const c = new Phaser.Math.Vector2(this.player.x, this.player.y);
    let hitAny = false;
    for (const e of [...(this.enemies.getChildren() as Enemy[])]) {
      if (!e.active) continue;
      const d = Phaser.Math.Distance.BetweenPoints(c, e) - e.def.radius;
      if (d > s.radius) continue;
      const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.BetweenPoints(c, e) - s.angle));
      if (diff > s.arcRad / 2) continue;
      hitAny = true;
      this.damageEnemy(e, s.damage, c, s.knockback, 'Дуговой клинок');
    }
    if (hitAny) this.player.onMeleeHit();
  }

  private hitPlayer(dmg: number, source: string) {
    if (this.dead) return;
    if (this.player.isInvulnerable) return;
    const barrier = this.skills.find((s): s is Barrier => s instanceof Barrier);
    if (barrier) { dmg = barrier.absorb(dmg); if (dmg <= 0) { this.player.grantInvuln(150); return; } }
    if (!this.player.takeDamage(dmg, source)) return;
    if (this.player.hp <= 0) {
      if (this.run.mods.lastBreath && !this.run.mods.lastBreathUsed) {
        this.run.mods.lastBreathUsed = true;
        this.player.hp = 30;
        this.player.grantInvuln(2000);
        return;
      }
      this.dead = true;
      this.killer = source;
      this.player.setVelocity(0, 0);
      for (const e of this.enemies.getChildren() as Enemy[]) e.setVelocity(0, 0);
      this.endRun(false);
    }
  }

  // ---------- зоны (Шлейф пепла и будущие) ----------

  private addZone(x: number, y: number, r: number, durationSec: number, dps: number, tickSec: number, slow = 1) {
    const color = slow < 1 ? 0x7fd48a : 0xff7a3c;
    const gfx = this.add.circle(x, y, r, color, 0.22).setStrokeStyle(1, color, 0.6).setDepth(3);
    this.zones.push({ x, y, r, until: this.time.now + durationSec * 1000, nextTick: this.time.now, dps, tickSec, slow, gfx });
  }

  private updateZones() {
    const now = this.time.now;
    this.zones = this.zones.filter((z) => {
      if (now >= z.until) { z.gfx.destroy(); return false; }
      if (now >= z.nextTick) {
        z.nextTick = now + z.tickSec * 1000;
        const from = new Phaser.Math.Vector2(z.x, z.y);
        for (const e of [...(this.enemies.getChildren() as Enemy[])])
          if (e.active && Phaser.Math.Distance.BetweenPoints(from, e) <= z.r + e.def.radius) {
            if (z.slow < 1) e.applySlow(z.slow, z.tickSec * 1000 + 100);
            this.damageEnemy(e, z.dps * z.tickSec * this.run.mods.damageMult, from, 0, z.slow < 1 ? 'Шипастая земля' : 'Шлейф пепла');
          }
      }
      return true;
    });
  }

  // ---------- волны и комнаты ----------

  private spawnWave() {
    this.waveStarted = true;
    if (this.isBossRoom) {
      const pos = new Phaser.Math.Vector2(ROOM.width / 2, ROOM.wall + 120);
      this.pendingSpawns++;
      this.telegraphSpawn(pos, () => {
        this.pendingSpawns--;
        this.boss = new Boss(this, pos.x, pos.y, 'boss_hammer', ENEMIES.boss_hammer as EnemyDef, this.run.tier, this.run.room);
        this.boss.windupMs *= this.run.mods.enemyWindupMult;
        this.enemies.add(this.boss);
      });
      return;
    }
    let n = enemyCount(ROOM.baseCount, this.run.tier, this.run.room);
    if (this.isEliteRoom) n = Math.round(n * ELITE_ROOM.countMult);
    const maxRanged = Math.floor(n * ROOM.maxRangedShare);
    let ranged = 0;
    const act = Math.ceil(this.run.room / RUN.roomsPerAct);
    const composition = ROOM.compositionByAct[Math.min(act, ROOM.compositionByAct.length) - 1] as Record<string, number>;
    const perRoom = new Map<string, number>();
    const center = new Phaser.Math.Vector2(this.player.x, this.player.y);
    for (let i = 0; i < n; i++) {
      let id = this.rng.pick<EnemyId>(composition);
      const def = ENEMIES[id] as EnemyDef;
      if (def.role === 'ranged' && ranged >= maxRanged) id = 'rusher';
      if (def.maxPerRoom && (perRoom.get(id) ?? 0) >= def.maxPerRoom) id = 'rusher';
      if ((ENEMIES[id] as EnemyDef).role === 'ranged') ranged++;
      perRoom.set(id, (perRoom.get(id) ?? 0) + 1);
      const pos = this.spawnPoint(center);
      this.pendingSpawns++;
      this.telegraphSpawn(pos, () => {
        this.pendingSpawns--;
        const e = new Enemy(this, pos.x, pos.y, id, ENEMIES[id] as EnemyDef, this.run.tier, this.run.room);
        e.windupMs *= this.run.mods.enemyWindupMult;
        if (this.isEliteRoom) { e.hp = Math.round(e.hp * ELITE_ROOM.hpMult); (e as { maxHp: number }).maxHp = e.hp; e.setScale(1.15); }
        this.enemies.add(e);
      });
    }
  }

  private spawnPoint(center: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    const { width, height, wall } = ROOM;
    for (let tries = 0; tries < 20; tries++) {
      const side = Math.floor(this.rng.range(0, 4));
      const t = this.rng.range(0.1, 0.9);
      const p = side === 0 ? new Phaser.Math.Vector2(wall + 40, wall + t * (height - wall * 2))
        : side === 1 ? new Phaser.Math.Vector2(width - wall - 40, wall + t * (height - wall * 2))
        : side === 2 ? new Phaser.Math.Vector2(wall + t * (width - wall * 2), wall + 40)
        : new Phaser.Math.Vector2(wall + t * (width - wall * 2), height - wall - 40);
      if (Phaser.Math.Distance.BetweenPoints(p, center) > 260) return p;
    }
    return new Phaser.Math.Vector2(wall + 40, wall + 40);
  }

  private telegraphSpawn(p: Phaser.Math.Vector2, onDone: () => void) {
    const ring = this.add.circle(p.x, p.y, 4, 0x8fd3ff, 0).setStrokeStyle(2, 0x8fd3ff, 0.9).setDepth(4);
    this.tweens.add({ targets: ring, radius: 26, duration: ROOM.spawnTelegraphSec * 1000, ease: 'Quad.Out',
      onUpdate: () => ring.setRadius(ring.radius), onComplete: () => { ring.destroy(); onDone(); } });
  }

  private onRoomCleared() {
    this.advancing = true;
    this.cleared = true;
    this.run.hp = this.player.hp;
    // Лут (GDD §H): босс — всегда, Логово элиты — 50 %, Сокровищница — 35 %
    const dropChance = this.isBossRoom ? F.loot.bossDropChance : this.run.nextDoor === 'elite' ? F.loot.eliteRoomDropChance : this.run.nextDoor === 'shards' ? F.loot.treasuryDropChance : 0;
    if (dropChance > 0 && this.rng.next() < dropChance) {
      const id = rollItem(this.rng, this.run.tier, this.run.backpack);
      if (id) { this.run.backpack.push(id); this.showToast(`Найдено: ${ITEMS[id].name} — ${ITEMS[id].text}`); }
    }
    // Награды дверей — после зачистки
    switch (this.run.nextDoor) {
      case 'shards': this.run.addShards(SHARDS_DOOR_BONUS); break;
      case 'facet': this.run.addOffer(`Награда: ${DOORS.facet.name}`); break;
      case 'elite': this.run.addShards(ELITE_ROOM.shardsBonus); this.run.addGold(goldForEliteRoom(this.run.tier)); this.run.addEcho(echoForEliteRoom(this.run.tier)); this.run.addOffer(`Награда: ${DOORS.elite.name}`); break;
      case 'shop': this.shopPending = true; break;
    }
    this.run.nextDoor = null;
    if (this.isLastRoom) { this.time.delayedCall(900, () => this.endRun(true)); return; }
    this.time.delayedCall(ROOM.clearDelaySec * 1000 * 0.5, () => this.nextStep());
  }

  /** После комнаты: сначала все накопленные выборы Рун, затем дверь, затем следующая комната */
  private nextStep() {
    if (this.run.pendingOffers > 0) {
      this.choosing = true;
      this.player.setVelocity(0, 0);
      this.currentOffer = offerFacets(this.rng, { ownedSkills: this.run.skills, ownedFacets: this.run.facets, rank: this.run.rank });
      if (this.currentOffer.length === 0) { this.run.pendingOffers = 0; this.choosing = false; this.nextStep(); return; }
      const reason = this.run.offerReasons[0] ?? `Ранг ${this.run.rank}`;
      this.openOverlay('facet', { offer: this.currentOffer, rerollsLeft: this.run.rerollsLeft, rank: this.run.rank, title: `${reason} — выбери Руну`, more: this.run.pendingOffers - 1 });
      return;
    }
    if (this.shopPending && !this.shop) {
      this.player.setVelocity(0, 0);
      this.shop = new Shop(this.rng, this.run);
      this.openOverlay('shop', { shop: this.shop, hp: this.player.hp, maxHp: this.player.maxHp });
      return;
    }
    if (!this.doorPending && this.run.nextDoor === null) {
      this.doorPending = true;
      const nextRoom = this.run.room + 1;
      const doors = offerDoors(this.rng, { nextRoomIsBoss: nextRoom % RUN.roomsPerAct === 0, hp01: this.player.hp / this.player.maxHp, rank: this.run.rank, nextRoom });
      this.openOverlay('door', { doors });
      return;
    }
    this.run.onRoomAdvance();
    this.scene.restart({ run: this.run });
  }

  /** Единая точка открытия оверлея: сцена поверх + пауза арены (оба — в очередь менеджера сцен) */
  private openOverlay(key: 'facet' | 'door' | 'shop', data: object) {
    if (this.scene.isActive(key)) this.scene.stop(key);
    this.overlayData = { key, data };
    this.overlaySince = this.time.now;
    this.scene.launch(key, data);
    this.scene.pause();
    this.emit();
  }

  private closeOverlay() {
    this.overlayData = null;
    if (this.scene.isPaused()) this.scene.resume();
  }

  private onDoorChosen(reward: DoorReward) {
    if (!this.doorPending) return;
    this.closeOverlay();
    this.run.nextDoor = reward;
    this.doorPending = false;
    this.time.delayedCall(120, () => { this.run.onRoomAdvance(); this.scene.restart({ run: this.run }); });
  }

  private onShopClosed() {
    if (!this.shopPending) return;
    this.closeOverlay();
    this.shopPending = false;
    this.shop = null;
    this.run.hp = this.player.hp;
    this.time.delayedCall(150, () => this.nextStep());
  }

  /** Пересчёт производных характеристик игрока после смены модов (Руна, экипировка) */
  private applyModsToPlayer() {
    const oldMax = this.player.maxHp;
    this.player.maxHp = Math.max(1, 100 + this.run.mods.maxHpDelta);
    this.player.hp = Math.min(this.player.hp + Math.max(0, this.player.maxHp - oldMax), this.player.maxHp);
    this.player.dodgeMax = 1 + this.run.mods.dodgeChargesBonus;
    this.player.dodgeCharges = Math.min(this.player.dodgeCharges, this.player.dodgeMax);
    this.run.hp = this.player.hp;
  }

  private exitToHub() {
    if (!this.isTestRun) saveRun(this.run.toSave());
    for (const k of ['hud', 'facet', 'door', 'gear', 'shop']) if (this.scene.isActive(k)) this.scene.stop(k);
    this.scene.stop();
    this.scene.start('title');
  }

  private onFacetChosen(id: string) {
    if (!this.choosing) return;
    this.closeOverlay();
    const wasStart = this.run.rank === 0 && this.run.facets.length === 0;
    this.run.takeFacet(id);
    this.choosing = false;
    this.applyModsToPlayer();
    if (wasStart) {
      this.player.dodgeCharges = this.player.dodgeMax;
      if (!this.isTestRun) saveRun(this.run.toSave());
      this.roomIntro(() => this.spawnWave());
      return;
    }
    this.time.delayedCall(200, () => this.nextStep());
  }

  private onFacetReroll() {
    if (!this.choosing || this.run.rerollsLeft <= 0) return;
    this.closeOverlay();
    this.run.rerollsLeft--;
    this.choosing = false;
    this.time.delayedCall(150, () => this.nextStep());
  }

  private showToast(text: string) {
    this.toast = text;
    this.time.delayedCall(3500, () => { if (this.toast === text) this.toast = ''; });
  }

  /** Конец забега: запись прогресса (GDD §9) и экран итогов */
  private endRun(won: boolean) {
    if (this.finished) return;
    this.finished = true;
    const before = loadProgress();
    const loot = won ? this.run.backpack : keepOnDeath(this.run.backpack);
    if (!this.isTestRun) clearRun();
    // Надетое из рюкзака, что не доехало домой, снимается
    let p0 = before;
    for (const [slot, id] of Object.entries(this.run.equipped)) {
      if (id && !before.inventory.includes(id) && !loot.includes(id) && p0.equipped[slot as keyof typeof p0.equipped] === id) p0 = { ...p0, equipped: { ...p0.equipped, [slot]: undefined } };
    }
    const after = recordRun(p0, this.run.tier, this.run.room, won, this.run.xp, loot, echoRunTotal(this.run.echo, won));
    this.time.delayedCall(won ? 400 : 1200, () =>
      this.scene.launch('summary', { run: this.run, won, killer: this.killer, progress: after, unlockedNew: after.unlockedTier > before.unlockedTier, loot }));
  }

  private emit(paused = false) {
    const snap: ArenaSnapshot = {
      act: Math.ceil(this.run.room / RUN.roomsPerAct), roomInAct: ((this.run.room - 1) % RUN.roomsPerAct) + 1, roomsPerAct: RUN.roomsPerAct, acts: RUN.acts,
      boss: this.boss && this.boss.active ? { name: this.boss.def.name, hp01: this.boss.hp / this.boss.maxHp, phase: this.boss.bossPhase } : null,
      roomTag: this.run.nextDoor && this.run.nextDoor !== 'boss' ? DOORS[this.run.nextDoor].name : '',
      paused, lastError: (globalThis as unknown as { __arkfallError?: string }).__arkfallError ?? '',
      tier: this.run.tier, room: this.run.room, seed: this.run.seed, kills: this.run.kills,
      alive: this.enemies.countActive(true), cleared: this.cleared, dead: this.dead, killer: this.killer,
      hp: this.player.hp, maxHp: this.player.maxHp, dodgeCharges: this.player.dodgeCharges, dodgeMax: this.player.dodgeMax, dodge01: this.player.dodgeCooldown01,
      rhythm: this.player.rhythmStacks, rank: this.run.rank, shards: this.run.shards, nextRankAt: this.run.nextRankAt, gold: this.run.gold, echo: this.run.echo,
      skills: this.skills.map((s) => s.view()), facets: this.run.facets, xp: this.run.xp, hasRhythm: this.player.hasRhythm, backpack: this.run.backpack, toast: this.toast, ttkSamples: this.run.ttkSamples,
    };
    this.game.events.emit('arena-state', snap);
    (globalThis as unknown as { __arkfall?: ArenaSnapshot }).__arkfall = snap; // для e2e-тестов
  }
}
