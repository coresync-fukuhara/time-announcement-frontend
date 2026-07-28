import { test, expect } from '@playwright/test';

// テスト基盤の疎通用スモーク。
// 画面は schedules.json の有無で「初期化ダイアログ」「本編集画面」のどちらを表示するか分岐する
// (未初期化時は <h1> を含まない)ため、どちらの分岐でも変わらない <title> で疎通のみ確認する。
// 主要シナリオ(初期化・編集・保存・再読み込み)は e2e/schedule-editing.spec.ts で確認する。
test('トップページが表示される', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('タイムアナウンスメント 設定');
});
