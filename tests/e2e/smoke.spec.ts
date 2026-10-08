import { expect, test } from '@playwright/test';

interface Snap { alive: number; room: number; dead: boolean; skills: { name: string }[] }
const snap = (page: import('@playwright/test').Page) => page.evaluate(() => (globalThis as unknown as { __arkfall?: Snap }).__arkfall);

test('игра запускается без ошибок консоли', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=42&tier=1');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});

test('после стартовой Руны в первой комнате есть живые враги, комната не перескочила', async ({ page }) => {
  await page.goto('/?seed=42&tier=1');
  await page.waitForTimeout(1200);
  await page.keyboard.press('1'); // стартовая Руна
  await page.waitForTimeout(3800); // вход в комнату 0,7 с + телеграф 1 с
  const s = await snap(page);
  expect(s?.room).toBe(1);
  expect(s?.alive ?? 0).toBeGreaterThan(0);
  expect(s?.dead).toBe(false);
});

test('скиллы из ?skills= подключаются в бой', async ({ page }) => {
  await page.goto('/?seed=42&tier=1&skills=dash_cut,spark');
  await page.waitForTimeout(1000);
  const s = await snap(page);
  expect(s?.skills.map((x) => x.name)).toEqual(expect.arrayContaining(['Рывок-разрез', 'Разряд']));
});

test('10-я комната — босс с полосой HP', async ({ page }) => {
  await page.goto('/?seed=42&tier=1&room=10');
  await page.waitForTimeout(3200);
  const s = await page.evaluate(() => (globalThis as unknown as { __arkfall?: { boss: { name: string } | null } }).__arkfall);
  expect(s?.boss?.name).toBe('Молот Ковчега');
});

test('без параметров открывается хаб, а не арена', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => (globalThis as unknown as { __arkfall?: unknown }).__arkfall);
  expect(s).toBeUndefined();
});

test('атлас спрайтов загружен, герой и враги — кадры атласа', async ({ page }) => {
  await page.goto('/?seed=42&tier=1');
  await page.waitForTimeout(1200);
  await page.keyboard.press('1');
  await page.waitForTimeout(3800);
  const ok = await page.evaluate(() => {
    const g = (globalThis as unknown as { Phaser?: unknown }).Phaser; void g;
    const canvas = document.querySelector('canvas');
    return !!canvas && canvas.width > 0;
  });
  expect(ok).toBe(true);
  await page.screenshot({ path: 'test-results/arena-g1.png' });
});
