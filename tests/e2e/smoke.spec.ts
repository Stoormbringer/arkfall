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

test('через 3 секунды в первой комнате есть живые враги, комната не перескочила', async ({ page }) => {
  await page.goto('/?seed=42&tier=1');
  await page.waitForTimeout(3000);
  const s = await snap(page);
  expect(s?.room).toBe(1);
  expect(s?.alive ?? 0).toBeGreaterThan(0);
  expect(s?.dead).toBe(false);
});

test('у игрока подключены MVP-скиллы', async ({ page }) => {
  await page.goto('/?seed=42&tier=1');
  await page.waitForTimeout(1000);
  const s = await snap(page);
  expect(s?.skills.map((x) => x.name)).toEqual(expect.arrayContaining(['Рывок-разрез', 'Разряд']));
});
