import { expect, test } from '@playwright/test';

test('игра запускается и рисует канвас без ошибок консоли', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?seed=42&tier=1');
  const canvas = page.locator('canvas');
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
