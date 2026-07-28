import { test, expect } from '@playwright/test';
import { readFile, writeFile, rm, access } from 'node:fs/promises';
import path from 'node:path';

// webServer(pnpm dev)は SETTINGS_DIR 未設定のため cwd/settings を使う(paths.ts のフォールバック)。
// devcontainer の実 settings/ を直接触るため、各テストの前後で元の内容を退避・復元する。
const SETTINGS_DIR = path.resolve(process.cwd(), 'settings');
const SCHEDULES_PATH = path.join(SETTINGS_DIR, 'schedules.json');
const BACKUP_PATH = path.join(SETTINGS_DIR, 'schedules.json.bak');
const TMP_PATH = path.join(SETTINGS_DIR, '.schedules.json.tmp');

async function fileExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function snapshot(p: string): Promise<string | null> {
  return (await fileExists(p)) ? readFile(p, 'utf-8') : null;
}

async function restore(p: string, content: string | null): Promise<void> {
  if (content === null) await rm(p, { force: true });
  else await writeFile(p, content, 'utf-8');
}

const emptySchedules = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
};

// このファイル内のテストは settings/schedules.json という共有ファイルを直接読み書きするため、
// 並列実行によるレースを避けて直列に実行する(テスト設計 4.3節)。
test.describe.configure({ mode: 'serial' });

test.describe('スケジュール設定画面 主要シナリオ', () => {
  let originalSchedules: string | null;
  let originalBackup: string | null;

  test.beforeEach(async () => {
    originalSchedules = await snapshot(SCHEDULES_PATH);
    originalBackup = await snapshot(BACKUP_PATH);
  });

  test.afterEach(async () => {
    await restore(SCHEDULES_PATH, originalSchedules);
    await restore(BACKUP_PATH, originalBackup);
    await rm(TMP_PATH, { force: true });
  });

  test('シナリオ1: 未初期化状態→初期化ダイアログ→空で始める→保存できる(No.9)', async ({ page }) => {
    await rm(SCHEDULES_PATH, { force: true });

    await page.goto('/');
    await expect(page.getByText('schedules.json が見つかりません')).toBeVisible();

    await page.getByRole('button', { name: /空の週間スケジュールで始める/ }).click();
    // 初期化直後は編集モードで開始する(保存ボタンが表示される)。
    await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '+ 時間を追加', exact: true }).click();
    await page.getByRole('button', { name: '9時', exact: true }).click();
    await page.getByRole('button', { name: '追加する', exact: true }).click();
    await page.getByRole('button', { name: '9時00分', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();

    // 保存後は閲覧(確認)モードへ戻る。
    await expect(page.getByRole('button', { name: '編集' })).toBeVisible();

    const saved = JSON.parse(await readFile(SCHEDULES_PATH, 'utf-8'));
    expect(saved.monday).toEqual([{ hour: 9, minutes: [0] }]);
  });

  test('シナリオ2: 曜日タブ切替→トグル→保存→再読み込み後も反映されている', async ({ page }) => {
    await writeFile(SCHEDULES_PATH, JSON.stringify(emptySchedules, null, 2), 'utf-8');

    await page.goto('/');
    await expect(page.getByRole('tab', { name: '月' })).toBeVisible();

    await page.getByRole('button', { name: '編集' }).click();
    await page.getByRole('tab', { name: '土' }).click();
    await page.getByRole('button', { name: '+ 時間を追加', exact: true }).click();
    await page.getByRole('button', { name: '10時', exact: true }).click();
    await page.getByRole('button', { name: '追加する', exact: true }).click();
    await page.getByRole('button', { name: '10時30分', exact: true }).click();
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByRole('button', { name: '編集' })).toBeVisible();

    await page.reload();
    await expect(page.getByRole('tab', { name: '月' })).toBeVisible();
    await page.getByRole('tab', { name: '土' }).click();
    await expect(page.getByRole('button', { name: '10時30分', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('シナリオ3: 保存前に未保存インジケーターが表示され、保存後に消える(No.2)', async ({
    page,
  }) => {
    await writeFile(
      SCHEDULES_PATH,
      JSON.stringify(
        { ...emptySchedules, monday: [{ hour: 9, minutes: [0] }] },
        null,
        2,
      ),
      'utf-8',
    );

    await page.goto('/');
    await page.getByRole('button', { name: '編集' }).click();
    await expect(page.getByText('未保存の変更があります')).not.toBeVisible();

    await page.getByRole('button', { name: '9時30分', exact: true }).click();
    await expect(page.getByText('未保存の変更があります')).toBeVisible();

    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect(page.getByText('未保存の変更があります')).not.toBeVisible();
  });
});
