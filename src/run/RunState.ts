import F from '../data/formulas.json';
import { shardsForRank } from '../core/formulas';
import { applyFacet, applyItem, defaultMods, type Mods } from './mods';
import { ITEMS } from './loot';
import type { ItemSlot } from '../data/types';

export type DoorKind = 'shards' | 'heal' | 'facet' | 'elite' | 'boss' | 'shop';

/** Сериализуемая часть забега — то, что уезжает в сохранение (GDD §5.5) */
export interface RunSave {
  v: 2;
  tier: number; seed: number; room: number; kills: number; xp: number;
  hp: number | null; shards: number; rank: number;
  gold: number; goldEarned: number; echo: number;
  pendingOffers: number; offerReasons: string[]; rerollsLeft: number;
  skills: string[]; facets: string[]; backpack: string[];
  equipped: Partial<Record<ItemSlot, string>>;
  startOfferDone: boolean; nextDoor: DoorKind | null; lastBreathUsed: boolean;
}

/** Состояние забега, живущее между комнатами (передаётся через scene.restart) */
export class RunState {
  tier: number;
  seed: number;
  room = 1;
  kills = 0;
  xp = 0;
  hp: number | null = null;
  shards = 0;
  rank = 0;
  /** Золото забега: сгорает в конце (GDD §8.1) */
  gold = 0;
  goldEarned = 0;
  /** Эхо, заработанное в забеге: уезжает домой и при смерти, +30 % — живым */
  echo = 0;
  pendingOffers = 0;
  offerReasons: string[] = [];
  rerollsLeft = F.facetOffer.rerollsPerAct;
  readonly skills: string[];
  readonly facets: string[] = [];
  readonly backpack: string[] = [];
  equipped: Partial<Record<ItemSlot, string>> = {};
  startOfferDone = false;
  nextDoor: DoorKind | null = null;
  /** один объект на весь забег — скиллы держат на него ссылку, поэтому пересборка идёт на месте */
  readonly mods: Mods = defaultMods();
  readonly ttkSamples: { role: string; sec: number; hits: number }[] = [];

  constructor(tier: number, seed: number, skills: string[], equipped: Partial<Record<ItemSlot, string>> = {}) {
    this.tier = tier; this.seed = seed; this.skills = skills;
    this.equipped = { ...equipped };
    this.rebuildMods();
  }

  /** Моды = база → экипировка → Руны. Флаги расхода (Последний вздох) переживают пересборку. */
  rebuildMods() {
    const used = this.mods.lastBreathUsed;
    Object.assign(this.mods, defaultMods());
    for (const id of Object.values(this.equipped)) if (id && ITEMS[id]) applyItem(this.mods, ITEMS[id]);
    for (const id of this.facets) applyFacet(this.mods, id);
    this.mods.lastBreathUsed = used;
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

  addGold(n: number) { this.gold += n; this.goldEarned += n; }
  addEcho(n: number) { this.echo += n; }
  spendGold(n: number): boolean {
    if (this.gold < n) return false;
    this.gold -= n;
    return true;
  }

  takeFacet(id: string) {
    this.facets.push(id);
    applyFacet(this.mods, id);
    this.pendingOffers = Math.max(0, this.pendingOffers - 1);
    this.offerReasons.shift();
  }

  addOffer(reason: string) { this.pendingOffers++; this.offerReasons.push(reason); }

  onRoomAdvance() {
    this.room++;
    if ((this.room - 1) % 10 === 0) this.rerollsLeft = F.facetOffer.rerollsPerAct;
  }

  toSave(): RunSave {
    return {
      v: 2, tier: this.tier, seed: this.seed, room: this.room, kills: this.kills, xp: this.xp, hp: this.hp,
      shards: this.shards, rank: this.rank, gold: this.gold, goldEarned: this.goldEarned, echo: this.echo, pendingOffers: this.pendingOffers, offerReasons: [...this.offerReasons],
      rerollsLeft: this.rerollsLeft, skills: [...this.skills], facets: [...this.facets], backpack: [...this.backpack],
      equipped: { ...this.equipped }, startOfferDone: this.startOfferDone, nextDoor: this.nextDoor, lastBreathUsed: this.mods.lastBreathUsed,
    };
  }

  static fromSave(s: RunSave): RunState {
    const r = new RunState(s.tier, s.seed, s.skills, s.equipped);
    r.room = s.room; r.kills = s.kills; r.xp = s.xp; r.hp = s.hp; r.shards = s.shards; r.rank = s.rank;
    r.gold = s.gold; r.goldEarned = s.goldEarned; r.echo = s.echo ?? 0;
    r.pendingOffers = s.pendingOffers; r.offerReasons = [...s.offerReasons]; r.rerollsLeft = s.rerollsLeft;
    r.facets.push(...s.facets); r.backpack.push(...s.backpack);
    r.startOfferDone = s.startOfferDone; r.nextDoor = s.nextDoor;
    r.mods.lastBreathUsed = s.lastBreathUsed;
    r.rebuildMods();
    return r;
  }
}
