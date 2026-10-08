import Phaser from 'phaser';
import ENEMIES from '../data/enemies.json';
import { ttkTarget } from '../core/formulas';
import { facetDef } from '../run/mods';
import { ITEMS } from '../run/loot';
import type { FacetRarity } from '../data/types';
import { loadSettings } from '../meta/Settings';
import { UI } from '../ui/theme';

const RARITY_HEX: Record<FacetRarity, number> = { common: 0x9aa4b8, rare: 0x6fb7ff, epic: 0xd38bff };
import type { ArenaSnapshot } from './ArenaScene';

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
type Sample = ArenaSnapshot['ttkSamples'][number];
const fmtRole = (role: keyof typeof ENEMIES, xs: Sample[]) =>
  xs.length ? `${ENEMIES[role].name} ${median(xs.map((x) => x.sec)).toFixed(2)} с / ${median(xs.map((x) => x.hits)).toFixed(0)} уд. (n=${xs.length})` : `${ENEMIES[role].name} —`;

export class HudScene extends Phaser.Scene {
  private bars!: Phaser.GameObjects.Graphics;
  private info!: Phaser.GameObjects.Text;
  private skillsText!: Phaser.GameObjects.Text;
  private facetsText!: Phaser.GameObjects.Text;
  private debug!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bossText!: Phaser.GameObjects.Text;
  private bossPortrait!: Phaser.GameObjects.Image;
  private toast!: Phaser.GameObjects.Text;
  private tooltip!: Phaser.GameObjects.Text;
  private runeIcons!: Phaser.GameObjects.Container;
  private bagIcons!: Phaser.GameObjects.Container;
  private runeKey = '';
  private bagKey = '';

  constructor() { super('hud'); }

  create() {
    const style = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '14px', color: '#e8e4d8' };
    // каменная плашка под верхней панелью и подсказкой
    const plate = this.add.graphics().setDepth(-1);
    plate.fillStyle(UI.bg, 0.55).fillRect(0, 0, 1280, 132).fillRect(0, 676, 1280, 44);
    plate.lineStyle(1, UI.stone, 0.9).lineBetween(0, 132, 1280, 132).lineBetween(0, 676, 1280, 676);
    this.bars = this.add.graphics();
    this.info = this.add.text(24, 48, '', style);
    this.skillsText = this.add.text(24, 72, '', { ...style, color: '#c9d1e0' });
    this.facetsText = this.add.text(24, 96, '', { ...style, fontSize: '11px', color: '#6f7890' });
    this.runeIcons = this.add.container(24, 112);
    this.bagIcons = this.add.container(1256, 690);
    this.tooltip = this.add.text(0, 0, '', { ...style, fontSize: '12px', backgroundColor: '#0b0d12ee', padding: { x: 8, y: 6 }, wordWrap: { width: 320 } }).setDepth(50).setVisible(false);
    this.debug = this.add.text(1256, 24, '', { ...style, color: '#9aa4b8', align: 'right' }).setOrigin(1, 0);
    this.toast = this.add.text(640, 160, '', { ...style, fontSize: '16px', color: '#f0c75e', backgroundColor: '#0b0d12cc', padding: { x: 10, y: 6 } }).setOrigin(0.5);
    this.bossText = this.add.text(640, 652, '', { ...style, fontSize: '13px', color: '#e0a62f' }).setOrigin(0.5, 1);
    this.bossPortrait = this.add.image(312, 652, 'sprites', 'portrait_boss_hammer').setScale(2).setVisible(false);
    this.banner = this.add.text(640, 330, '', { ...style, fontSize: '28px', align: 'center' }).setOrigin(0.5);
    this.add.text(640, 696, 'WASD — движение · ЛКМ — удар · ПКМ — рывок · Q/E/R/F — скиллы · Space — уклонение · I — снаряжение · Esc — меню', { ...style, color: '#6f7890', fontSize: '12px' }).setOrigin(0.5, 1);
    // вспышка экрана при уроне герою (настройка)
    const flash = this.add.rectangle(640, 360, 1280, 720, 0xb02030, 0).setDepth(40);
    const onHurt = () => { if (!loadSettings().flash || !this.scene.isActive()) return; flash.setAlpha(0.28); this.tweens.add({ targets: flash, alpha: 0, duration: 220 }); };
    this.game.events.on('player-hurt', onHurt);
    this.events.once('shutdown', () => this.game.events.off('player-hurt', onHurt));
    // Подписка на событие игры снимается при остановке сцены — иначе «призрачный» HUD пишет в уничтоженные объекты
    const handler = (s: ArenaSnapshot) => { if (this.scene.isActive()) this.render(s); };
    this.game.events.on('arena-state', handler);
    this.events.once('shutdown', () => this.game.events.off('arena-state', handler));
  }

  /** Значки Рун (слева сверху) и рюкзака (справа снизу): перерисовываются только при изменении состава */
  private renderIcons(s: ArenaSnapshot) {
    const rk = s.facets.join(',');
    if (rk !== this.runeKey) {
      this.runeKey = rk;
      this.runeIcons.removeAll(true);
      s.facets.forEach((id, i) => {
        const def = facetDef(id);
        const x = (i % 10) * 30, y = Math.floor(i / 10) * 30;
        const box = this.add.rectangle(x + 12, y + 12, 24, 24, UI.panel).setStrokeStyle(2, RARITY_HEX[def.rarity]).setInteractive({ useHandCursor: true });
        const letter = this.add.image(x + 12, y + 12, 'sprites', `rune_${id}`).setScale(1.25);
        box.on('pointerover', () => this.showTip(24 + x, 112 + y + 30, `${def.name} · ${def.rarity === 'common' ? 'обычная' : def.rarity === 'rare' ? 'редкая' : 'эпическая'}\n${def.effect}`));
        box.on('pointerout', () => this.tooltip.setVisible(false));
        this.runeIcons.add([box, letter]);
      });
    }
    const bk = s.backpack.join(',');
    if (bk !== this.bagKey) {
      this.bagKey = bk;
      this.bagIcons.removeAll(true);
      s.backpack.forEach((id, i) => {
        const item = ITEMS[id];
        const x = -(i % 10) * 30, y = -Math.floor(i / 10) * 30;
        const box = this.add.rectangle(x - 12, y - 12, 24, 24, UI.panel).setStrokeStyle(2, RARITY_HEX[item.rarity]).setInteractive({ useHandCursor: true });
        const letter = this.add.image(x - 12, y - 12, 'sprites', `item_${id}`).setScale(1.25);
        box.on('pointerover', () => this.showTip(1256 + x - 340, 690 + y - 70, `${item.name}\n${item.text}\nв рюкзаке — надеть можно в меню паузы (Esc → Снаряжение)`));
        box.on('pointerout', () => this.tooltip.setVisible(false));
        this.bagIcons.add([box, letter]);
      });
    }
  }

  private showTip(x: number, y: number, text: string) {
    this.tooltip.setText(text).setPosition(Math.min(x, 1280 - 340), Math.max(8, y)).setVisible(true);
  }

  private render(s: ArenaSnapshot) {
    const g = this.bars;
    g.clear();
    // HP
    g.fillStyle(0x000000, 0.7).fillRect(22, 22, 264, 20);
    g.fillStyle(UI.crimsonHex, 1).fillRect(24, 24, 260 * Math.max(0, s.hp / s.maxHp), 16);
    g.fillStyle(0xffffff, 0.12).fillRect(24, 24, 260 * Math.max(0, s.hp / s.maxHp), 5);
    g.lineStyle(1, UI.stoneHi, 1).strokeRect(22, 22, 264, 20);
    // заряды уклонения
    for (let i = 0; i < s.dodgeMax; i++) {
      const full = i < s.dodgeCharges;
      g.fillStyle(0x000000, 0.55).fillRect(24 + i * 44, 42, 40, 4);
      g.fillStyle(0x8fd3ff, 1).fillRect(24 + i * 44, 42, 40 * (full ? 1 : i === s.dodgeCharges ? s.dodge01 : 0), 4);
    }
    // Ранг
    g.fillStyle(0x000000, 0.7).fillRect(508, 22, 264, 14);
    g.fillStyle(UI.goldHex, 1).fillRect(510, 24, 260 * Math.min(1, s.shards / s.nextRankAt), 10);
    g.lineStyle(1, UI.stoneHi, 1).strokeRect(508, 22, 264, 14);

    if (s.boss) {
      g.fillStyle(0x000000, 0.6).fillRect(340, 660, 600, 14);
      g.fillStyle(0xe0a62f, 1).fillRect(340, 660, 600 * Math.max(0, s.boss.hp01), 14);
    }
    this.bossText.setText(s.boss ? `${s.boss.name} · фаза ${s.boss.phase}` : '');
    this.bossPortrait.setVisible(!!s.boss);
    if (s.boss) this.bossPortrait.setFrame(`portrait_${s.boss.id}`);
    if (s.boss) { g.fillStyle(UI.panel, 1).fillRect(292, 632, 40, 40); g.lineStyle(2, s.boss.phase === 2 ? UI.crimsonHex : UI.goldHex, 1).strokeRect(292, 632, 40, 40); }
    this.info.setText(`Тир ${s.tier} · Акт ${s.act}/${s.acts} · Комната ${s.roomInAct}/${s.roomsPerAct}${s.roomTag ? ' [' + s.roomTag + ']' : ''} · Враги ${s.alive} · Убито ${s.kills}      Ранг ${s.rank}  ${Math.floor(s.shards)}/${Math.ceil(s.nextRankAt)} осколков · ${s.gold} золота · Эхо +${s.echo} · опыт +${s.xp}`);
    const sk = s.skills.map((v) => `${v.key} ${v.name} ${v.charges !== undefined ? '●'.repeat(v.charges) + '○'.repeat((v.maxCharges ?? 0) - v.charges) : v.ready01 >= 1 ? '✓' : Math.round(v.ready01 * 100) + '%'}`);
    if (s.rhythm > 0 || s.hasRhythm) sk.push(`Ритм ${'|'.repeat(s.rhythm)}${'.'.repeat(5 - s.rhythm)}`);
    this.skillsText.setText(sk.join('    '));
    this.facetsText.setText(s.facets.length ? 'Руны' : '');
    this.toast.setText(s.toast).setVisible(s.toast.length > 0); // пустой текст с фоном рисует тёмный прямоугольник
    this.renderIcons(s);

    const by = (r: string) => s.ttkSamples.filter((x) => x.role === r);
    const common = s.ttkSamples.filter((x) => x.role !== 'tank');
    const med = median(common.map((x) => x.sec));
    const tankMed = median(by('tank').map((x) => x.sec));
    const band = (v: number, t: { min: number; max: number }, k: number) => (k ? (v >= t.min && v <= t.max ? '✓' : `✗ цель ${t.min}–${t.max}`) : '');
    this.debug.setText([
      `сид ${s.seed}`,
      `TTK обычных ${med.toFixed(2)} с (n=${common.length}) ${band(med, ttkTarget.common, common.length)} · танк ${band(tankMed, ttkTarget.tank, by('tank').length)}`,
      fmtRole('rusher', by('rusher')), fmtRole('shooter', by('shooter')), fmtRole('tank', by('tank')),
    ]);

    if (s.lastError) this.banner.setText(`Ошибка (пришли её в чат):\n${s.lastError}`).setColor('#ff6b5a');
    else this.banner.setColor('#e8e4d8');
    if (s.lastError) return;
    if (s.paused) this.banner.setText('Пауза\n\nEsc / P — продолжить');
    else if (s.dead) this.banner.setText('');
    else if (s.cleared) this.banner.setText('Комната пройдена');
    else this.banner.setText('');
  }
}
