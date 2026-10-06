import Phaser from 'phaser';
import ROOMS from './data/rooms.json';
import { ArenaScene } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';
import { FacetScene } from './scenes/FacetScene';
import { PauseScene } from './scenes/PauseScene';
import { TitleScene } from './scenes/TitleScene';
import { SummaryScene } from './scenes/SummaryScene';
import { SkillChoiceScene } from './scenes/SkillChoiceScene';

const g = globalThis as unknown as { __arkfallError?: string };
window.addEventListener('error', (e) => { g.__arkfallError = `${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`; });
window.addEventListener('unhandledrejection', (e) => { g.__arkfallError = String(e.reason); });

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: ROOMS.arena.width,
  height: ROOMS.arena.height,
  backgroundColor: '#0b0d12',
  pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).has('debug') } },
  scene: [BootScene, TitleScene, SkillChoiceScene, ArenaScene, HudScene, FacetScene, PauseScene, SummaryScene],
});
