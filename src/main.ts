import Phaser from 'phaser';
import ROOMS from './data/rooms.json';
import { ArenaScene } from './scenes/ArenaScene';
import { BootScene } from './scenes/BootScene';
import { HudScene } from './scenes/HudScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: ROOMS.arena.width,
  height: ROOMS.arena.height,
  backgroundColor: '#0b0d12',
  pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).has('debug') } },
  scene: [BootScene, ArenaScene, HudScene],
});
