import { test, expect } from '@playwright/test';

// テスト基盤の疎通用スモーク。UI 本実装後に主要シナリオ(初期化・編集・保存・再読み込み)を追加する。
test('トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
