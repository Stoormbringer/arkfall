import { describe, expect, it } from 'vitest';
import ATLAS from '../../src/data/atlas.json';
import FACETS from '../../src/data/facets.json';
import ITEMS from '../../src/data/items.json';
import ENEMIES from '../../src/data/enemies.json';

const frames = Object.keys(ATLAS.frames);
describe('атлас спрайтов (G1–G5)', () => {
  it('у каждого врага и героя есть 5 кадров, у босса — портрет', () => {
    for (const id of ['hero', ...Object.keys(ENEMIES)]) for (const f of ['idle0', 'idle1', 'walk0', 'walk1', 'attack']) expect(frames, `${id}_${f}`).toContain(`${id}_${f}`);
    for (const [id, d] of Object.entries(ENEMIES)) if ((d as { boss?: unknown }).boss) expect(frames).toContain(`portrait_${id}`);
  });
  it('у каждой Руны и предмета есть иконка 16×16', () => {
    for (const id of Object.keys(FACETS).filter((k) => !k.startsWith('_'))) { expect(frames, id).toContain(`rune_${id}`); expect((ATLAS.frames as Record<string, { frame: { w: number } }>)[`rune_${id}`].frame.w).toBe(16); }
    for (const id of Object.keys(ITEMS).filter((k) => !k.startsWith('_'))) expect(frames, id).toContain(`item_${id}`);
  });
  it('тайлы, снаряды, факел и частицы на месте', () => {
    for (const f of ['floor0', 'floor1', 'floor2', 'wall', 'wall_top', 'pillar', 'pit', 'torch0', 'torch1', 'bullet_enemy', 'bullet_player', 'p_blood', 'p_bone', 'p_fire']) expect(frames).toContain(f);
  });
});
