import F from '../data/formulas.json';
import { shardsForRank } from '../core/formulas';
import { applyFacet, defaultMods, type Mods } from './mods';

/** Состояние забега, живущее между комнатами (передаётся через scene.restart) */
export class RunState {
  tier: number;
  seed: number;
  room = 1;
  kills = 0;
  xp = 0; // опыт персонажа, набранный в забеге (GDD §5.2)
  hp: number | null = null; // null = полное при первом входе
  shards = 0;
  rank = 0;
  pendingOffers = 0;
  startOfferDone = false;
  rerollsLeft = F.facetOffer.rerollsPerAct;
  readonly skills: string[];
  readonly facets: string[] = [];
  readonly mods: Mods = defaultMods();
  readonly ttkSamples: { role: string; sec: number; hits: number }[] = [];

  constructor(tier: number, seed: number, skills: string[]) {
    this.tier = tier; this.seed = seed; this.skills = skills;
  }

  get nextRankAt() { return shardsForRank(this.rank + 1); }

  addShards(n: number) {
    this.shards += n * this.mods.shardMult;
    while (this.shards >= this.nextRankAt) {
      this.shards -= this.nextRankAt;
      this.rank++;
      this.pendingOffers++;
    }
  }

  takeFacet(id: string) {
    this.facets.push(id);
    applyFacet(this.mods, id);
    this.pendingOffers = Math.max(0, this.pendingOffers - 1);
  }

  /** Акт = 10 комнат: восстанавливает реролл */
  onRoomAdvance() {
    this.room++;
    if ((this.room - 1) % 10 === 0) this.rerollsLeft = F.facetOffer.rerollsPerAct;
  }
}
