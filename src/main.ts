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
import { DoorScene } from './scenes/DoorScene';
import { GearScene } from './scenes/GearScene';
import { ShopScene } from './scenes/ShopScene';
import { HubShopScene } from './scenes/HubShopScene';
import { SettingsScene } from './scenes/SettingsScene';

const g = globalThis as unknown as { __arkfallError?: string };
function showError(msg: string) {
  g.__arkfallError = msg;
  let el = document.getElementById('arkfall-error');
  if (!el) {
    el = document.createElement('pre');
    el.id = 'arkfall-error';
    el.style.cssText = 'position:fixed;left:12px;bottom:12px;max-width:60vw;padding:10px 12px;background:#2a0f0c;color:#ff8a7a;border:1px solid #ff6b5a;font:12px ui-monospace,Menlo,monospace;white-space:pre-wrap;z-index:9999;';
    document.body.appendChild(el);
  }
  el.textContent = `Ошибка (пришли её в чат):\n${msg}`;
}
window.addEventListener('error', (e) => {
  const stack = (e.error as Error | undefined)?.stack ?? '';
  const frames = stack.split('\n').slice(0, 8).map((l) => l.trim().replace(/https?:\/\/[^ ]*\//, '')).join('\n');
  showError(`${e.message}\n${frames}`);
});
window.addEventListener('unhandledrejection', (e) => showError(String(e.reason)));

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: ROOMS.arena.width,
  height: ROOMS.arena.height,
  backgroundColor: '#0b0d12',
  pixelArt: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  physics: { default: 'arcade', arcade: { debug: new URLSearchParams(location.search).has('debug') } },
  // Порядок = порядок отрисовки: оверлеи поверх арены и HUD идут ПОСЛЕ них, иначе launch() рисует их под ареной
  scene: [BootScene, TitleScene, SkillChoiceScene, ArenaScene, HudScene, FacetScene, DoorScene, PauseScene, GearScene, SummaryScene, ShopScene, HubShopScene, SettingsScene],
});
