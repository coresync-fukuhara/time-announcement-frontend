import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// このテストは devcontainer がバインドマウントする実 db/music.sqlite3・sounds/user/ を
// 直接使う(schedule-editing.spec.ts が実 settings/schedules.json を使うのと同じ前提)。
// audio_types に DEFAULT/NOTIFICATION/ALARM が既にシードされている前提(楽曲管理機能
// 概要設計書)。アップロード→タイプ変更→削除まで同一テスト内で完結させ、削除まで
// 到達すれば実データへの影響は残らない。

test.describe('楽曲管理画面 主要シナリオ', () => {
  test('シナリオ: アップロード→一覧に反映→タイプ変更→削除', async ({ page }) => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'track-e2e-'));
    const fileName = `e2e_test_track_${Date.now()}.wav`;
    const filePath = path.join(tmpDir, fileName);
    await writeFile(filePath, Buffer.from('RIFF----WAVEfmt dummy-content-for-e2e-test'));
    const trackName = fileName.replace(/\.wav$/i, '');

    try {
      await page.goto('/tracks');
      await expect(page.getByRole('heading', { name: 'アップロード済み' })).toBeVisible();

      await page.locator('input[type="file"]').setInputFiles(filePath);
      await expect(page.getByText(trackName, { exact: true })).toBeVisible();

      const notificationBadge = page.getByRole('button', { name: `${trackName} NOTIFICATION` });
      await notificationBadge.click();
      await expect(notificationBadge).toHaveAttribute('aria-pressed', 'true');

      await page.getByRole('button', { name: `${trackName} を削除` }).click();
      await page.getByRole('button', { name: '削除する', exact: true }).click();
      await expect(page.getByText(trackName, { exact: true })).not.toBeVisible();
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
