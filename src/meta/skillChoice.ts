import SKILLS_RAW from '../data/skills.json';
import F from '../data/formulas.json';
import type { Rng } from '../core/rng';
import type { SkillCategory, SkillDef } from '../data/types';

export const SKILLS = Object.fromEntries(Object.entries(SKILLS_RAW).filter(([k]) => !k.startsWith('_'))) as Record<string, SkillDef>;

/** Скиллы, реализованные в бою. Остальные не предлагаются (GDD §C — каталог шире прототипа). */
export const IMPLEMENTED_SKILLS = ['dash_cut', 'spark', 'blood_rhythm', 'shard_shot', 'gravity_well', 'barrier', 'spike_ground'] as const;

/**
 * GDD §5.7 / §C.1: 3 скилла из РАЗНЫХ категорий; категории, которых у игрока ещё нет, весят вдвое больше.
 */
export function offerSkills(rng: Rng, owned: string[], level: number, pool: readonly string[] = IMPLEMENTED_SKILLS): string[] {
  const ownedCats = new Set(owned.map((id) => SKILLS[id].category));
  let candidates = pool.filter((id) => !owned.includes(id) && SKILLS[id].offerFrom <= level);
  const out: string[] = [];
  const usedCats = new Set<SkillCategory>();
  while (out.length < F.milestones.offerCount && candidates.length) {
    const weights: Record<string, number> = {};
    for (const id of candidates) {
      const c = SKILLS[id].category;
      if (usedCats.has(c)) continue;
      weights[id] = ownedCats.has(c) ? 1 : F.milestones.missingCategoryWeight;
    }
    if (!Object.keys(weights).length) {
      // категории исчерпаны — добираем из оставшихся, чтобы выбор всегда был из 3
      for (const id of candidates) weights[id] = 1;
    }
    const id = rng.pick<string>(weights);
    out.push(id);
    usedCats.add(SKILLS[id].category);
    candidates = candidates.filter((x) => x !== id);
  }
  return out;
}
