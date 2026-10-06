import F from '../data/formulas.json';
import { shardsForRank } from '../core/formulas';
import { applyFacet, applyItem, defaultMods, type Mods } from './mods';
import { ITEMS } from './loot';

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
  /** источники ожидающих выборов Руны — для заголовка экрана */
  offerReasons: string[] = [];
  startOfferDone = false;
  /** награда за выбранной дверью — применяется к следующей комнате */
  nextDoor: 'shards' | 'heal' | 'facet' | 'elite' | 'boss' | null = null;
  rerollsLeft = F.facetOffer.rerollsPerAct;
  readonly skills: string[];
  readonly facets: string[] = [];
  readonly backpack: string[] = [];
  readonly mods: Mods = defaultMods();
  readonly ttkSamples: { role: string; sec: number; hits: number }[] = [];

  constructor(tier: number, seed: number, skills: string[], equipped: string[] = []) {
    this.tier = tier; this.seed = seed; this.skills = skills;
    for (const id of equipped) if (ITEMS[id]) applyItem(this.mods, ITEMS[id]);
  }

  get nextRankAt() { return shardsForRank(this.rank + 1); }

  addShards(n: number) {
    this.shards += n * this.mods.shardMult;
    while (this.shards >= this.nextRankAt) {
      this.shards -= this.nextRankAt;
      this.rank++;
      this.pendingOffers++;
      this.offerReasons.push(`Ранг ${this.rank}`);
    }
  }

  takeFacet(id: string) {
    this.facets.push(id);
    applyFacet(this.mods, id);
    this.pendingOffers = Math.max(0, this.pendingOffers - 1);
    this.offerReasons.shift();
  }

  /** Выбор Руны от награды места (Алтарь, Логово элиты) */
  addOffer(reason: string) { this.pendingOffers++; this.offerReasons.push(reason); }

  /** Акт = 10 комнат: восстанавливает реролл */
  onRoomAdvance() {
    this.room++;
    if ((this.room - 1) % 10 === 0) this.rerollsLeft = F.facetOffer.rerollsPerAct;
  }
}
