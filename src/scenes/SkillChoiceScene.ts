import Phaser from 'phaser';
import { backdrop, heading, UI } from '../ui/theme';
import { Rng } from '../core/rng';
import { chooseSkill, loadProgress } from '../meta/Progress';
import { offerSkills, SKILLS } from '../meta/skillChoice';
import { levelFromXp } from '../meta/Level';

const CAT: Record<string, string> = { melee: 'Ближний бой', ranged: 'Дальний бой', magic: 'Магия', summon: 'Призыв', control: 'Контроль', defense: 'Защита', mobility: 'Мобильность' };
const RES = (s: (typeof SKILLS)[string]) =>
  s.resource.kind === 'cooldown' ? `откат ${s.resource.cooldownSec} с` : s.resource.kind === 'charges' ? `${s.resource.charges} заряда, восст. ${s.resource.rechargeSec} с` : 'пассив';

/** Выбор Основного скилла на милстоуне (GDD §5.1, §C.1). Вызывается из хаба, пока есть pendingMilestones. */
export class SkillChoiceScene extends Phaser.Scene {
  constructor() { super('skillchoice'); }

  create() {
    let progress = loadProgress();
    const milestone = progress.pendingMilestones[0];
    if (milestone === undefined) { this.scene.start('title'); return; }
    const level = levelFromXp(progress.xp).level;
    const rng = new Rng(progress.xp * 7 + milestone);
    const offer = offerSkills(rng, progress.skills, Math.max(level, milestone));
    const mono = { fontFamily: 'ui-monospace, Menlo, monospace', color: '#e8e4d8' };

    backdrop(this);
    heading(this, 60, 'МИЛСТОУН', `Уровень ${milestone} — новый Основной скилл`, UI.ice);
    this.add.text(640, 148, 'Постоянный выбор. Сброс — в Лавке Ковчега за Эхо. Клик или 1 / 2 / 3', { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);

    const cardW = 340, cardH = 360, gap = 40;
    const x0 = 640 - (cardW * 3 + gap * 2) / 2 + cardW / 2;
    offer.forEach((id, i) => {
      const s = SKILLS[id];
      const cx = x0 + i * (cardW + gap), cy = 400;
      const card = this.add.rectangle(cx, cy, cardW, cardH, 0x161a23).setStrokeStyle(2, 0x8fd3ff).setInteractive({ useHandCursor: true });
      this.add.text(cx, cy - 150, `${i + 1}`, { ...mono, fontSize: '14px', color: '#6f7890' }).setOrigin(0.5);
      this.add.text(cx, cy - 116, s.name, { ...mono, fontSize: '22px' }).setOrigin(0.5);
      this.add.text(cx, cy - 88, `${CAT[s.category]} · ${s.type === 'passive' ? 'пассив' : 'актив'} · ${RES(s)}`, { ...mono, fontSize: '12px', color: '#8fd3ff' }).setOrigin(0.5);
      const lines = [
        describe(id),
        '',
        `Синергии: ${s.synergies.map((x) => SKILLS[x]?.name ?? x).join(', ')}`,
      ];
      this.add.text(cx, cy - 60, lines.join('\n'), { ...mono, fontSize: '14px', wordWrap: { width: cardW - 36 }, align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0);
      card.on('pointerover', () => card.setFillStyle(0x1f2430));
      card.on('pointerout', () => card.setFillStyle(0x161a23));
      const pick = () => { progress = chooseSkill(progress, id); this.scene.start(progress.pendingMilestones.length ? 'skillchoice' : 'title'); };
      card.on('pointerdown', pick);
      this.input.keyboard!.once(`keydown-${['ONE', 'TWO', 'THREE'][i]}`, pick);
    });
    if (progress.pendingMilestones.length > 1) this.add.text(640, 640, `Ещё выборов: ${progress.pendingMilestones.length - 1}`, { ...mono, fontSize: '13px', color: '#6f7890' }).setOrigin(0.5);
  }
}

function describe(id: string): string {
  const b = SKILLS[id].base as Record<string, number>;
  switch (id) {
    case 'dash_cut': return `Рывок сквозь врагов на ${b.length} px: ${b.damage} урона всем на линии, неуязвимость в рывке. ПКМ.`;
    case 'spark': return `Цепная молния по ${b.jumps} ближайшим врагам: ${b.damage} урона, −${b.falloff * 100} % за прыжок.`;
    case 'blood_rhythm': return `Удары подряд копят Ритм: +${b.attackSpeedPerStack * 100} % скорости атаки за стак, до ${b.maxStacks}. Спад через ${b.decaySec} с без ударов.`;
    case 'shard_shot': return `Снаряд ${b.damage} урона, при попадании делится на ${b.shards} осколка по ${b.shardDamage}.`;
    case 'gravity_well': return `Точка в прицеле стягивает врагов в радиусе ${b.radius} px на ${b.durationSec} с. Тяжёлые враги и боссы иммунны.`;
    case 'barrier': return `Пузырь поглощает ${b.absorb} урона; при сломе взрыв ${b.burstDamage} в радиусе ${b.burstRadius}.`;
    case 'spike_ground': return `Зона радиусом ${b.radius} на ${b.durationSec} с: ${b.damage} урона каждые ${b.tickSec} с, замедление ${b.slow * 100} %.`;
    case 'riposte': return `Пассив. Уклонение сквозь удар врага — парирование: следующий удар клинка в ${b.windowSec} с наносит ×${b.damageMult} урона и бьёт на ×${b.areaMult} дальше.`;
    case 'echo_strike': return `Замах ${b.windupSec} с на месте, затем удар по всем в радиусе 100: ${b.damage} урона и оглушение ${b.stunSec} с. +${b.rhythmBonusPerStack * 100} % за стак Ритма, Ритм тратится.`;
    case 'phantom_blade': return `Клинок кружит рядом ${b.durationSec} с и бьёт ближайшего врага каждые ${b.attackSec} с на ${b.damage}. Наследует половину бонуса урона.`;
    default: return '';
  }
}
