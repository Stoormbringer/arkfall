import F from '../data/formulas.json';
import { facetDef, IMPLEMENTED_FACETS } from './mods';
import type { Rng } from '../core/rng';
import type { FacetRarity } from '../data/types';

export interface OfferInput {
  ownedSkills: string[];
  ownedFacets: string[];
  rank: number;
  pool?: readonly string[];
}

const weightOf = (r: FacetRarity) => (F.facetOffer.rarityWeights as Record<FacetRarity, number>)[r];

function draw(rng: Rng, ids: string[], rank: number): string | null {
  const allowed = ids.filter((id) => facetDef(id).rarity !== 'epic' || rank >= F.facetOffer.epicFromRank);
  if (!allowed.length) return null;
  const weights = Object.fromEntries(allowed.map((id) => [id, weightOf(facetDef(id).rarity)]));
  return rng.pick<string>(weights);
}

/** GDD §C.4: 2 Руны, привязанные к скиллам игрока, + 1 дикая; без повторов; эпические с Ранга 4. */
/** Стартовая Руна на 0-й секунде (GDD §2, шаг 2): 3 диких, без эпических */
export function offerStartFacets(rng: Rng): string[] {
  let wild = IMPLEMENTED_FACETS.filter((id) => facetDef(id).binds === null && facetDef(id).rarity !== 'epic');
  const out: string[] = [];
  while (out.length < 3 && wild.length) {
    const id = draw(rng, [...wild], 1);
    if (!id) break;
    out.push(id);
    wild = wild.filter((x) => x !== id);
  }
  return out;
}

export function offerFacets(rng: Rng, input: OfferInput): string[] {
  const pool = (input.pool ?? IMPLEMENTED_FACETS).filter((id) => !input.ownedFacets.includes(id));
  let bound = pool.filter((id) => { const b = facetDef(id).binds; return b !== null && input.ownedSkills.includes(b); });
  let wild = pool.filter((id) => facetDef(id).binds === null);
  const out: string[] = [];
  const take = (from: 'bound' | 'wild') => {
    const src = from === 'bound' ? bound : wild;
    const id = draw(rng, src, input.rank);
    if (!id) return false;
    out.push(id);
    bound = bound.filter((x) => x !== id);
    wild = wild.filter((x) => x !== id);
    return true;
  };
  for (let i = 0; i < F.facetOffer.bound; i++) if (!take('bound')) take('wild');
  for (let i = 0; i < F.facetOffer.wild; i++) if (!take('wild')) take('bound');
  return out;
}
