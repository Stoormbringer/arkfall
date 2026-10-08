import Phaser from 'phaser';
import P from '../data/player.json';
import SKILLS from '../data/skills.json';
import type { Mods } from '../run/mods';
import { SPRITE_SCALE } from '../scenes/BootScene';
import { shake } from '../meta/Settings';

export interface PlayerInput {
  move: Phaser.Math.Vector2;
  aim: Phaser.Math.Vector2;
  attack: boolean;
  dodge: boolean;
}

export interface Strike { angle: number; radius: number; arcRad: number; damage: number; knockback: number; ignoreShield: boolean }

const RHYTHM = SKILLS.blood_rhythm.base;
const RIPOSTE = SKILLS.riposte.base;

export class Player extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  maxHp: number;
  invulnUntil = 0;
  lastHitBy = '';
  lastDamagedAt = -1e9;
  private regenAcc = 0;
  // уклонение с зарядами (GDD: «Запас» +1 заряд)
  dodgeMax: number;
  dodgeCharges: number;
  dodgeRechargeAt = 0;
  private dodgeUntil = 0;
  private dodgeDir = new Phaser.Math.Vector2();
  // Кровавый ритм
  rhythmStacks = 0;
  private rhythmLastHit = 0;
  hasRhythm = false;
  // Жало ответа: парирование (уклонение сквозь удар) заряжает следующий удар
  hasRiposte = false;
  riposteUntil = 0;
  private attackReadyAt = 0;
  private attackPoseUntil = 0;
  private swing: Phaser.GameObjects.Graphics;
  private mods: Mods;

  constructor(scene: Phaser.Scene, x: number, y: number, mods: Mods, hp?: number) {
    super(scene, x, y, 'sprites', 'hero_idle0');
    this.mods = mods;
    this.maxHp = P.hp + mods.maxHpDelta;
    this.hp = Math.min(this.maxHp, hp ?? this.maxHp);
    this.dodgeMax = 1 + mods.dodgeChargesBonus;
    this.dodgeCharges = this.dodgeMax;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setScale(SPRITE_SCALE);
    const r = P.radius / SPRITE_SCALE;
    this.setCircle(r, 16 - r, 16 - r);
    this.play('hero_idle');
    this.setCollideWorldBounds(true);
    this.setDepth(10);
    this.invulnUntil = scene.time.now + P.spawnInvulnSec * 1000;
    this.swing = scene.add.graphics().setDepth(11);
  }

  get isInvulnerable() { return this.scene.time.now < this.invulnUntil; }
  get isDodging() { return this.scene.time.now < this.dodgeUntil; }
  get dodgeCooldown01() {
    if (this.dodgeCharges >= this.dodgeMax) return 1;
    const total = P.dodge.cooldownSec * 1000 * this.mods.cooldownMult;
    return Phaser.Math.Clamp(1 - (this.dodgeRechargeAt - this.scene.time.now) / total, 0, 1);
  }
  get attackSpeedMult() { return (1 + this.rhythmStacks * (RHYTHM.attackSpeedPerStack as number)) * this.mods.attackSpeedMult; }

  grantInvuln(ms: number) { this.invulnUntil = Math.max(this.invulnUntil, this.scene.time.now + ms); }

  /** Вызывается боем при каждом попадании ближним ударом */
  onMeleeHit() {
    if (!this.hasRhythm) return;
    this.rhythmStacks = Math.min(RHYTHM.maxStacks as number, this.rhythmStacks + 1);
    this.rhythmLastHit = this.scene.time.now;
  }

  /** Возвращает параметры удара, если атака состоялась */
  /** Пассивная регенерация вне боя: hpPerSec после afterNoDamageSec без урона (GDD: поощряет уклонение) */
  regen(dtSec: number) {
    if (this.hp <= 0 || this.hp >= this.maxHp) return;
    if (this.scene.time.now - this.lastDamagedAt < P.regen.afterNoDamageSec * 1000) return;
    this.regenAcc += P.regen.hpPerSec * this.mods.regenMult * dtSec;
    if (this.regenAcc >= 1) { const n = Math.floor(this.regenAcc); this.regenAcc -= n; this.heal(n); }
  }

  handleInput(input: PlayerInput, locked: boolean): Strike | null {
    const now = this.scene.time.now;
    if (this.hasRhythm && this.rhythmStacks > 0 && now - this.rhythmLastHit > this.mods.rhythm.decaySec * 1000) this.rhythmStacks = 0;

    if (this.dodgeCharges < this.dodgeMax && now >= this.dodgeRechargeAt) {
      this.dodgeCharges++;
      if (this.dodgeCharges < this.dodgeMax) this.dodgeRechargeAt = now + P.dodge.cooldownSec * 1000 * this.mods.cooldownMult;
    }

    if (input.dodge && this.dodgeCharges > 0 && !this.isDodging && !locked) {
      const dir = input.move.lengthSq() > 0 ? input.move.clone() : input.aim.clone().subtract(new Phaser.Math.Vector2(this.x, this.y)).normalize();
      this.dodgeDir.copy(dir);
      this.dodgeUntil = now + P.dodge.durationSec * 1000;
      this.grantInvuln(P.dodge.iframesSec * 1000);
      if (this.dodgeCharges === this.dodgeMax) this.dodgeRechargeAt = now + P.dodge.cooldownSec * 1000 * this.mods.cooldownMult;
      this.dodgeCharges--;
    }

    if (locked) { /* рывок управляет скоростью сам */ }
    else if (this.isDodging) this.setVelocity(this.dodgeDir.x * P.dodge.speed, this.dodgeDir.y * P.dodge.speed);
    else this.setVelocity(input.move.x * P.speed * this.mods.moveSpeedMult, input.move.y * P.speed * this.mods.moveSpeedMult);
    this.setAlpha(this.isInvulnerable ? 0.55 : 1);
    this.updatePose(input);

    if (input.attack && now >= this.attackReadyAt && !this.isDodging && !locked) {
      this.attackReadyAt = now + (P.weapon.cooldownSec * 1000) / this.attackSpeedMult;
      const angle = Phaser.Math.Angle.Between(this.x, this.y, input.aim.x, input.aim.y);
      const arcRad = Phaser.Math.DegToRad(P.weapon.arcDeg);
      this.drawSwing(angle, arcRad);
      this.attackPoseUntil = now + 160;
      this.setFlipX(Math.cos(angle) < 0);
      let damage = P.weapon.damage * this.mods.damageMult;
      let radius = P.weapon.radius * this.mods.meleeRadiusMult;
      if (this.mods.echoOfPainArmed) { damage *= 1.5; this.mods.echoOfPainArmed = false; }
      if (this.hasRiposte && now < this.riposteUntil) { damage *= RIPOSTE.damageMult as number; radius *= RIPOSTE.areaMult as number; this.riposteUntil = 0; }
      const ignoreShield = this.hasRhythm && this.mods.rhythm.pierceAtMax && this.rhythmStacks >= (RHYTHM.maxStacks as number);
      return { angle, radius, arcRad, damage, knockback: P.weapon.knockback * this.mods.knockbackMult, ignoreShield };
    }
    return null;
  }

  takeDamage(amount: number, source: string): boolean {
    if (this.isInvulnerable) return false;
    this.hp = Math.max(0, this.hp - amount * this.mods.damageTakenMult);
    this.lastHitBy = source;
    this.lastDamagedAt = this.scene.time.now;
    if (this.mods.echoOfPain) this.mods.echoOfPainArmed = true;
    this.invulnUntil = this.scene.time.now + 350;
    shake(this.scene.cameras.main, 80, 0.004);
    this.scene.game.events.emit('player-hurt');
    this.setTintFill(0xffffff);
    this.scene.time.delayedCall(70, () => this.active && this.clearTint());
    return true;
  }

  heal(amount: number) { this.hp = Math.min(this.maxHp, this.hp + amount); }

  /** Кадр: удар держится 160 мс, иначе шаг/стойка; смотрим в сторону прицела */
  private updatePose(input: PlayerInput) {
    const now = this.scene.time.now;
    if (now < this.attackPoseUntil) { this.anims.stop(); this.setFrame('hero_attack'); return; }
    const moving = (this.body!.velocity as Phaser.Math.Vector2).lengthSq() > 1;
    const want = moving ? 'hero_walk' : 'hero_idle';
    if (this.anims.currentAnim?.key !== want || !this.anims.isPlaying) this.play(want, true);
    const dx = input.aim.x - this.x;
    if (Math.abs(dx) > 8) this.setFlipX(dx < 0);
  }

  private drawSwing(angle: number, arcRad: number) {
    this.swing.clear();
    this.swing.fillStyle(0xf5f1e6, 0.5);
    this.swing.slice(this.x, this.y, P.weapon.radius, angle - arcRad / 2, angle + arcRad / 2, false);
    this.swing.fillPath();
    this.scene.tweens.add({ targets: this.swing, alpha: { from: 1, to: 0 }, duration: 110, onComplete: () => { this.swing.clear(); this.swing.alpha = 1; } });
  }
}
