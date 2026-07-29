# 楽曲管理画面(`/tracks`)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存の `/api/tracks`・`/api/tracks/:id`・`/api/audio-types`(実装済み)の上に、`/tracks` 画面(一覧表示・アップロード・インライン名前変更・音声タイプ割り当て・削除)を実装する。

**Architecture:** 既存の `/`(スケジュール設定画面)と同じ Next.js App Router 構成に、新規ルート `src/app/tracks/page.tsx` を追加する。全操作をサーバーへ即時反映する薄いクライアントコンポーネント(`TrackRow`・`TrackSection`・`UploadDropzone`・`NavSwitcher`)で構成し、既存の汎用ダイアログ(`ConfirmDialog`・`ErrorDialog`)を再利用する。バックエンド(データ層・API)は実装済みのため、本計画は UI 層のみが対象。

**Tech Stack:** Next.js App Router(Client Components)・React 19・Vitest + React Testing Library(コンポーネント)・Playwright(E2E)。新規の外部依存追加は無し。

**関連文書:** [楽曲管理画面(`/tracks`)画面詳細設計](../specs/2026-07-29-music-management-screen-design.md)

## Global Constraints

- 保存モデルは全操作即時反映。明示的な保存ボタンは持たない(画面詳細設計 2章)。
- `PATCH /api/tracks/:id`(`src/app/api/tracks/[id]/route.ts`)は `name`・`audioTypeIds` を両方必須とする全置換方式。名前だけ・タイプ割り当てだけを変更する場合も、変更しない側のフィールドは現在値のまま一緒に送ること(画面詳細設計 6.1・6.2節)。
- 楽観的更新はしない。クリック時点では表示を変えず、サーバー応答が返ってから `state` を更新する(画面詳細設計 6.2節)。
- アップロードは1ファイルのみ対応。複数ファイル同時ドロップはエラーとし、サーバーへは送らない(画面詳細設計 6.4節)。
- クライアント側でも拡張子(`.wav`)・サイズ(10MB以下、`MAX_UPLOAD_BYTES = 10 * 1024 * 1024`)を事前チェックする(画面詳細設計 6.4節)。
- `origin` が `default`・`unknown` の楽曲は名前変更・削除不可、音声タイプ変更のみ可。UI上は「初期音源・その他(名前変更・削除不可)」の1セクションにまとめ、両者を区別しない(画面詳細設計 4.2節)。
- 既存の `ConfirmDialog`・`ErrorDialog` を再利用する。新規のモーダルコンポーネントは作らない。`ErrorDialog` は `description` prop を追加して汎用化する(画面詳細設計 7章)。
- ページ間ナビゲーション(`/` ⇄ `/tracks`)はプレーンな `<a>` タグで実装する。`next/link` は使わない(フルページ遷移でよい。テスト容易性のための判断)。
- 楽曲関連のクライアント側型(`Track`・`TrackAudioType`・`TrackOrigin`)は `src/lib/types.ts` に追加する。サーバー専用モジュールの `src/lib/track-store.ts`(`node:sqlite` 等に依存)をクライアントコンポーネントから直接 import しない。
- 各セクション内の並び順は名前の昇順(`sortTracksByName`)。

---

## Task 1: `src/lib/types.ts` に楽曲関連の型を追加

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces: `TrackOrigin`(`'default' | 'user' | 'unknown'`)、`TrackAudioType { id: number; name: string }`、`Track { id: number; name: string; filePath: string; origin: TrackOrigin; audioTypes: TrackAudioType[] }`。以降の全タスクがこれを import する。

型のみの追加でテストは無い(既存の `types.ts` 自体にも専用テストファイルは無い)。`tsc --noEmit` での確認のみ行う。

- [ ] **Step 1: 型を追加する**

`src/lib/types.ts` の末尾に追記:

```ts
// 楽曲管理機能の型。実際の妥当性検証は DB 側(wav_tracks・audio_types・
// track_audio_types)が真であり、これは API レスポンス(GET/POST/PATCH
// /api/tracks・/api/audio-types)の形に対応する TypeScript 上の表現
// (画面詳細設計 8章)。src/lib/track-store.ts と型を分離するのは、
// track-store.ts が node:sqlite 等サーバー専用の依存を持つため、
// クライアントコンポーネントから直接 import しないようにするため。

export type TrackOrigin = 'default' | 'user' | 'unknown';

export interface TrackAudioType {
  id: number;
  name: string;
}

export interface Track {
  id: number;
  name: string;
  filePath: string;
  origin: TrackOrigin;
  audioTypes: TrackAudioType[];
}
```

- [ ] **Step 2: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し(既存コードも含めて成功)

- [ ] **Step 3: commit**

```bash
git add src/lib/types.ts
git commit -m "feat: 楽曲管理画面用の型(Track/TrackAudioType/TrackOrigin)を追加"
```

---

## Task 2: `src/lib/track-ui.ts`(純粋関数)の実装

**Files:**
- Create: `src/lib/track-ui.ts`
- Test: `src/lib/track-ui.test.ts`

**Interfaces:**
- Consumes: `Track`・`TrackAudioType`・`TrackOrigin`(Task 1、`@/lib/types`)
- Produces: `MAX_UPLOAD_BYTES: number`、`toggleAudioTypeId(current: number[], id: number): number[]`、`isEditableOrigin(origin: TrackOrigin): boolean`、`sortTracksByName(tracks: Track[]): Track[]`、`describeTrackError(body: unknown): string`。Task 6・7・8・9 がこれらを import する。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/track-ui.test.ts`:

```ts
import {
  MAX_UPLOAD_BYTES,
  toggleAudioTypeId,
  isEditableOrigin,
  sortTracksByName,
  describeTrackError,
} from '@/lib/track-ui';
import type { Track } from '@/lib/types';

describe('track-ui', () => {
  it('MAX_UPLOAD_BYTES は10MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024);
  });

  describe('toggleAudioTypeId', () => {
    it('未割り当てのidを渡すと追加する', () => {
      expect(toggleAudioTypeId([1], 2)).toEqual([1, 2]);
    });

    it('割り当て済みのidを渡すと除去する', () => {
      expect(toggleAudioTypeId([1, 2], 2)).toEqual([1]);
    });

    it('元の配列を変更しない', () => {
      const original = [1];
      toggleAudioTypeId(original, 2);
      expect(original).toEqual([1]);
    });
  });

  describe('isEditableOrigin', () => {
    it('user のみ true', () => {
      expect(isEditableOrigin('user')).toBe(true);
      expect(isEditableOrigin('default')).toBe(false);
      expect(isEditableOrigin('unknown')).toBe(false);
    });
  });

  describe('sortTracksByName', () => {
    it('名前の昇順で並べ替える(元の配列は変更しない)', () => {
      const tracks: Track[] = [
        { id: 1, name: 'school_bell', filePath: '/a', origin: 'user', audioTypes: [] },
        { id: 2, name: 'chime_intro', filePath: '/b', origin: 'user', audioTypes: [] },
      ];
      const sorted = sortTracksByName(tracks);
      expect(sorted.map((t) => t.name)).toEqual(['chime_intro', 'school_bell']);
      expect(tracks.map((t) => t.name)).toEqual(['school_bell', 'chime_intro']);
    });
  });

  describe('describeTrackError', () => {
    it('conflict + field=name のとき名前重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict', field: 'name' })).toBe(
        '同じ表示名の楽曲が既に存在します。',
      );
    });

    it('conflict + field=file_path のときファイル重複メッセージを返す', () => {
      expect(describeTrackError({ error: 'conflict', field: 'file_path' })).toBe(
        '同名のファイルが既に存在します。',
      );
    });

    it('forbidden のとき変更不可メッセージを返す', () => {
      expect(describeTrackError({ error: 'forbidden' })).toBe('この楽曲は変更できません。');
    });

    it('not_found のとき見つからないメッセージを返す', () => {
      expect(describeTrackError({ error: 'not_found' })).toBe(
        '対象の楽曲が見つかりませんでした(一覧を更新してください)。',
      );
    });

    it('未知のエラーコード・nullのときは汎用メッセージを返す', () => {
      expect(describeTrackError(null)).toBe('サーバーとの通信でエラーが発生しました。');
      expect(describeTrackError({ error: 'io_error' })).toBe('サーバーとの通信でエラーが発生しました。');
    });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/lib/track-ui.test.ts`
Expected: FAIL(`Cannot find module '@/lib/track-ui'`)

- [ ] **Step 3: 実装する**

`src/lib/track-ui.ts`:

```ts
// 楽曲管理画面のクライアント側ユーティリティ(純粋関数のみ)。
// schedule-ui.ts と同じ役割: 画面固有のロジックをコンポーネントから切り離し、
// 単体でテストできるようにする。

import type { Track, TrackOrigin } from './types';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

// 音声タイプバッジのクリック時に次の audioTypeIds を計算する(画面詳細設計 6.2節)。
export function toggleAudioTypeId(current: number[], id: number): number[] {
  return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
}

// origin が "user" の楽曲のみ名前変更・削除ができる(画面詳細設計 4.2節)。
export function isEditableOrigin(origin: TrackOrigin): boolean {
  return origin === 'user';
}

export function sortTracksByName(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => a.name.localeCompare(b.name));
}

interface TrackErrorBody {
  error?: string;
  field?: 'name' | 'file_path';
}

// /api/tracks・/api/tracks/:id のエラーレスポンス(body)を画面表示用の文言に変換する
// (画面詳細設計 7章)。
export function describeTrackError(body: unknown): string {
  const { error, field } = (body ?? {}) as TrackErrorBody;
  switch (error) {
    case 'invalid_extension':
      return '.wav 形式のファイルのみアップロードできます。';
    case 'file_too_large':
      return 'ファイルサイズが大きすぎます(上限10MB)。';
    case 'invalid_file_name':
      return 'ファイル名に使用できない文字が含まれています。';
    case 'file_missing':
      return 'ファイルが選択されていません。';
    case 'conflict':
      return field === 'name'
        ? '同じ表示名の楽曲が既に存在します。'
        : '同名のファイルが既に存在します。';
    case 'invalid_audio_type_ids':
      return '音声タイプの指定が不正です。';
    case 'invalid_name':
      return '名前を入力してください。';
    case 'not_found':
      return '対象の楽曲が見つかりませんでした(一覧を更新してください)。';
    case 'forbidden':
      return 'この楽曲は変更できません。';
    default:
      return 'サーバーとの通信でエラーが発生しました。';
  }
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/lib/track-ui.test.ts`
Expected: PASS(全ケース)

- [ ] **Step 5: commit**

```bash
git add src/lib/track-ui.ts src/lib/track-ui.test.ts
git commit -m "feat: 楽曲管理画面のクライアント側ユーティリティ(track-ui)を実装"
```

---

## Task 3: `ErrorDialog` に `description` prop を追加(汎用化)

**Files:**
- Modify: `src/components/ErrorDialog.tsx`
- Modify: `src/__tests__/components/ErrorDialog.test.tsx`

**Interfaces:**
- Produces: `ErrorDialogProps` に `description?: string` を追加(省略時は既存のスケジュール画面向け文言をデフォルト値として使う。既存呼び出し元 `src/app/page.tsx` は無変更で動作する)。Task 9 がこの `description` を使う。

- [ ] **Step 1: 失敗するテストを追加する**

`src/__tests__/components/ErrorDialog.test.tsx` の `describe('ErrorDialog', ...)` 内、最後の `it` の後に追加:

```tsx
  it('description を渡すと差し替わる(楽曲管理画面での再利用を想定)', () => {
    render(
      <ErrorDialog
        open
        message="アップロードに失敗しました"
        description="同じ表示名の楽曲が既に存在します。"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument();
    expect(screen.getByText('同じ表示名の楽曲が既に存在します。')).toBeInTheDocument();
    expect(
      screen.queryByText('入力内容の検証でエラーが発生しました。内容を確認してください。'),
    ).not.toBeInTheDocument();
  });

  it('description を省略すると既定の文言(スケジュール画面向け)が表示される', () => {
    render(<ErrorDialog open message="保存に失敗しました" onClose={() => {}} />);
    expect(
      screen.getByText('入力内容の検証でエラーが発生しました。内容を確認してください。'),
    ).toBeInTheDocument();
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/ErrorDialog.test.tsx`
Expected: FAIL(1件目: `description` prop が無いため差し替わらず、既定文言がそのまま表示されてしまう)

- [ ] **Step 3: 実装する**

`src/components/ErrorDialog.tsx` を全体置き換え:

```tsx
'use client';

import dialogStyles from './dialog.module.css';

export interface ErrorDialogProps {
  open: boolean;
  message: string;
  description?: string;
  detail?: string;
  onClose: () => void;
}

// 保存(PUT /api/schedules)失敗時のエラー表示として導入(ブレインストーミングでの決定)。
// 楽曲管理画面(/tracks)でも同じコンポーネントを再利用するため、本文(description)を
// 呼び出し側で差し替え可能にした(画面詳細設計 7章)。省略時は元のスケジュール画面向けの
// 文言をそのまま使う(後方互換)。
export function ErrorDialog({
  open,
  message,
  description = '入力内容の検証でエラーが発生しました。内容を確認してください。',
  detail,
  onClose,
}: ErrorDialogProps) {
  if (!open) return null;

  return (
    <div
      className={dialogStyles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={dialogStyles.dialog} role="alertdialog" aria-label="エラー">
        <h2 style={{ color: 'var(--danger)' }}>{message}</h2>
        <p>{description}</p>
        {detail && <div className={dialogStyles.detail}>{detail}</div>}
        <div className={dialogStyles.dialogActions} style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/ErrorDialog.test.tsx`
Expected: PASS(既存3ケース+新規2ケース)

- [ ] **Step 5: commit**

```bash
git add src/components/ErrorDialog.tsx src/__tests__/components/ErrorDialog.test.tsx
git commit -m "feat: ErrorDialogにdescription propを追加し楽曲管理画面でも再利用可能にする"
```

---

## Task 4: `NavSwitcher` コンポーネント(ヘッダーのアイコン切替)

**Files:**
- Create: `src/components/NavSwitcher.tsx`
- Create: `src/components/NavSwitcher.module.css`
- Test: `src/__tests__/components/NavSwitcher.test.tsx`

**Interfaces:**
- Produces: `NavSwitcherProps { current: 'schedule' | 'tracks' }`、`NavSwitcher` コンポーネント。Task 5・9 がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/NavSwitcher.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { NavSwitcher } from '@/components/NavSwitcher';

describe('NavSwitcher', () => {
  it('current="schedule" のとき、スケジュール設定側が aria-current=page になる', () => {
    render(<NavSwitcher current="schedule" />);
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '楽曲管理' })).not.toHaveAttribute('aria-current');
  });

  it('current="tracks" のとき、楽曲管理側が aria-current=page になる', () => {
    render(<NavSwitcher current="tracks" />);
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('スケジュール設定リンクは / を指す', () => {
    render(<NavSwitcher current="tracks" />);
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).toHaveAttribute('href', '/');
  });

  it('楽曲管理リンクは /tracks を指す', () => {
    render(<NavSwitcher current="schedule" />);
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('href', '/tracks');
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/NavSwitcher.test.tsx`
Expected: FAIL(`Cannot find module '@/components/NavSwitcher'`)

- [ ] **Step 3: 実装する**

`src/components/NavSwitcher.module.css`:

```css
.switcher {
  display: flex;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 30px;
  font-size: 15px;
  text-decoration: none;
  color: var(--ink-soft);
  background: var(--panel);
}

.link:hover {
  background: var(--accent-soft);
}

.link + .link {
  border-left: 1px solid var(--panel-border);
}

.linkActive {
  background: var(--accent-soft);
  color: var(--accent-ink);
}
```

`src/components/NavSwitcher.tsx`:

```tsx
import styles from './NavSwitcher.module.css';

export interface NavSwitcherProps {
  current: 'schedule' | 'tracks';
}

// ヘッダー右のアイコン切替(🕐 スケジュール設定 / 🎵 楽曲管理)。プレーンな <a> による
// フルページ遷移にする(2画面間の行き来は頻繁ではないため、クライアント側ルーティングの
// 複雑さをあえて避ける。画面詳細設計 4.1節)。
export function NavSwitcher({ current }: NavSwitcherProps) {
  return (
    <div className={styles.switcher} role="group" aria-label="画面切替">
      <a
        href="/"
        aria-label="スケジュール設定"
        aria-current={current === 'schedule' ? 'page' : undefined}
        className={current === 'schedule' ? `${styles.link} ${styles.linkActive}` : styles.link}
      >
        🕐
      </a>
      <a
        href="/tracks"
        aria-label="楽曲管理"
        aria-current={current === 'tracks' ? 'page' : undefined}
        className={current === 'tracks' ? `${styles.link} ${styles.linkActive}` : styles.link}
      >
        🎵
      </a>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/NavSwitcher.test.tsx`
Expected: PASS(4ケース)

- [ ] **Step 5: commit**

```bash
git add src/components/NavSwitcher.tsx src/components/NavSwitcher.module.css src/__tests__/components/NavSwitcher.test.tsx
git commit -m "feat: ヘッダーのアイコン切替(NavSwitcher)を実装"
```

---

## Task 5: 既存 `/` 画面(スケジュール設定)への `NavSwitcher` 組み込み

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `NavSwitcher`(Task 4、`@/components/NavSwitcher`)

- [ ] **Step 1: 失敗するアサーションを追加する**

`src/__tests__/page.test.tsx` の1件目のテスト(`'読み込み後、既存のスケジュールを確認(閲覧)モードで表示する'`)の最後に1行追加:

```tsx
  it('読み込み後、既存のスケジュールを確認(閲覧)モードで表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ initialized: true, schedules: baseSchedules })),
    );
    render(<Home />);
    expect(await screen.findByRole('tab', { name: '月' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9時00分' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('href', '/tracks');
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/page.test.tsx`
Expected: FAIL(該当テストのみ。「楽曲管理」リンクが存在しない)

- [ ] **Step 3: `page.tsx` に組み込む**

`src/app/page.tsx:10-11` の import 部分に追加(`CopyDiff` の import の後):

```tsx
import { CopyDiff } from '@/components/CopyDiff';
import { NavSwitcher } from '@/components/NavSwitcher';
```

`src/app/page.tsx:222-229` を次のように変更:

```tsx
      <header className={styles.topbar}>
        <h1>時報 設定</h1>
        <div className={styles.actions}>
          <NavSwitcher current="schedule" />
          {dirty && <span className={styles.unsavedChip}>未保存の変更があります</span>}
          <button type="button" onClick={handleSave} disabled={saving}>
            {viewMode ? '編集' : saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/page.test.tsx`
Expected: PASS(4ケース全て。既存3ケースが壊れていないことも確認する)

- [ ] **Step 5: commit**

```bash
git add src/app/page.tsx src/__tests__/page.test.tsx
git commit -m "feat: スケジュール設定画面のヘッダーにNavSwitcherを組み込む"
```

---

## Task 6: `UploadDropzone` コンポーネント

**Files:**
- Create: `src/components/UploadDropzone.tsx`
- Create: `src/components/UploadDropzone.module.css`
- Test: `src/__tests__/components/UploadDropzone.test.tsx`

**Interfaces:**
- Consumes: `MAX_UPLOAD_BYTES`(Task 2、`@/lib/track-ui`)
- Produces: `UploadDropzoneProps { uploading: boolean; onUpload: (file: File) => void; onValidationError: (message: string) => void }`、`UploadDropzone` コンポーネント。Task 9 がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/UploadDropzone.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UploadDropzone } from '@/components/UploadDropzone';

function wavFile(name = 'chime.wav', size = 1024): File {
  return new File([new Uint8Array(size)], name, { type: 'audio/wav' });
}

describe('UploadDropzone', () => {
  it('既定のラベルを表示する', () => {
    render(<UploadDropzone uploading={false} onUpload={() => {}} onValidationError={() => {}} />);
    expect(screen.getByText('📁 .wav をドラッグ&ドロップ、またはクリックして追加')).toBeInTheDocument();
  });

  it('uploading=true のときは「アップロード中...」を表示し、非活性になる', () => {
    render(<UploadDropzone uploading onUpload={() => {}} onValidationError={() => {}} />);
    expect(screen.getByText('アップロード中...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '楽曲をアップロード' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('.wav ファイルを選択すると onUpload にそのファイルを渡す', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    render(<UploadDropzone uploading={false} onUpload={onUpload} onValidationError={() => {}} />);
    const input = screen.getByLabelText('ファイルを選択');
    const file = wavFile();
    await user.upload(input, file);
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('.wav 以外の拡張子は onValidationError を呼び、onUpload は呼ばない', async () => {
    const user = userEvent.setup();
    const onUpload = vi.fn();
    const onValidationError = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={onUpload} onValidationError={onValidationError} />,
    );
    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, wavFile('chime.mp3'));
    expect(onValidationError).toHaveBeenCalledWith('.wav 形式のファイルのみアップロードできます。');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('10MB超のファイルは onValidationError を呼ぶ', async () => {
    const user = userEvent.setup();
    const onValidationError = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={() => {}} onValidationError={onValidationError} />,
    );
    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, wavFile('big.wav', 10 * 1024 * 1024 + 1));
    expect(onValidationError).toHaveBeenCalledWith('ファイルサイズが大きすぎます(上限10MB)。');
  });

  it('複数ファイルを同時にドロップすると onValidationError を呼ぶ', () => {
    const onValidationError = vi.fn();
    const onUpload = vi.fn();
    render(
      <UploadDropzone uploading={false} onUpload={onUpload} onValidationError={onValidationError} />,
    );
    const zone = screen.getByRole('button', { name: '楽曲をアップロード' });
    fireEvent.drop(zone, { dataTransfer: { files: [wavFile('a.wav'), wavFile('b.wav')] } });
    expect(onValidationError).toHaveBeenCalledWith('一度に1つのファイルだけ選択してください。');
    expect(onUpload).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/UploadDropzone.test.tsx`
Expected: FAIL(`Cannot find module '@/components/UploadDropzone'`)

- [ ] **Step 3: 実装する**

`src/components/UploadDropzone.module.css`:

```css
.dropzone {
  position: relative;
  background: var(--accent-soft);
  border: 2px dashed var(--accent);
  border-radius: var(--radius);
  padding: 22px;
  text-align: center;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--accent-ink);
  cursor: pointer;
}

.dropzone:hover {
  filter: brightness(1.03);
}

.uploading {
  cursor: default;
  opacity: 0.75;
}

.hiddenInput {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

`src/components/UploadDropzone.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { MAX_UPLOAD_BYTES } from '@/lib/track-ui';
import styles from './UploadDropzone.module.css';

export interface UploadDropzoneProps {
  uploading: boolean;
  onUpload: (file: File) => void;
  onValidationError: (message: string) => void;
}

// 常設のアップロード領域(画面詳細設計 4章)。ドラッグ&ドロップ・クリックどちらでも
// 1ファイルのみ受け付ける。拡張子・サイズはサーバーに投げる前にクライアント側でも
// 事前チェックし、無駄な往復を減らす(画面詳細設計 6.4節)。
export function UploadDropzone({ uploading, onUpload, onValidationError }: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | { length: number; [index: number]: File } | null) {
    if (uploading || !files) return;
    if (files.length > 1) {
      onValidationError('一度に1つのファイルだけ選択してください。');
      return;
    }
    const file = files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.wav')) {
      onValidationError('.wav 形式のファイルのみアップロードできます。');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      onValidationError('ファイルサイズが大きすぎます(上限10MB)。');
      return;
    }
    onUpload(file);
  }

  function handleClick() {
    if (uploading) return;
    inputRef.current?.click();
  }

  return (
    <div
      className={uploading ? `${styles.dropzone} ${styles.uploading}` : styles.dropzone}
      role="button"
      tabIndex={0}
      aria-label="楽曲をアップロード"
      aria-disabled={uploading}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        handleFiles(e.dataTransfer.files);
      }}
    >
      {uploading ? 'アップロード中...' : '📁 .wav をドラッグ&ドロップ、またはクリックして追加'}
      <input
        ref={inputRef}
        type="file"
        accept=".wav"
        aria-label="ファイルを選択"
        className={styles.hiddenInput}
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/UploadDropzone.test.tsx`
Expected: PASS(6ケース)

- [ ] **Step 5: commit**

```bash
git add src/components/UploadDropzone.tsx src/components/UploadDropzone.module.css src/__tests__/components/UploadDropzone.test.tsx
git commit -m "feat: 常設アップロードドロップゾーン(UploadDropzone)を実装"
```

---

## Task 7: `TrackRow` コンポーネント

**Files:**
- Create: `src/components/TrackRow.tsx`
- Create: `src/components/TrackRow.module.css`
- Test: `src/__tests__/components/TrackRow.test.tsx`

**Interfaces:**
- Consumes: `isEditableOrigin`(Task 2、`@/lib/track-ui`)、`Track`・`TrackAudioType`(Task 1、`@/lib/types`)
- Produces: `TrackRowProps { track: Track; audioTypes: TrackAudioType[]; busy: boolean; onRename: (name: string) => void; onToggleAudioType: (audioTypeId: number) => void; onDelete: () => void }`、`TrackRow` コンポーネント。Task 8 がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/TrackRow.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackRow } from '@/components/TrackRow';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [
  { id: 1, name: 'DEFAULT' },
  { id: 2, name: 'NOTIFICATION' },
  { id: 3, name: 'ALARM' },
];

const userTrack: Track = {
  id: 10,
  name: 'chime_intro',
  filePath: '/data/sounds/user/chime_intro.wav',
  origin: 'user',
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

const defaultTrack: Track = {
  id: 20,
  name: 'default_chime',
  filePath: '/data/sounds/default/default_chime.wav',
  origin: 'default',
  audioTypes: [],
};

describe('TrackRow', () => {
  it('origin=user の行は名前ボタン・削除ボタンを表示する', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeInTheDocument();
  });

  it('origin=default の行は名前がラベル表示になり、削除ボタンの代わりに🔒を表示する', () => {
    render(
      <TrackRow
        track={defaultTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /クリックして名前を変更/ })).not.toBeInTheDocument();
    expect(screen.getByText('default_chime')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /を削除/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('編集不可')).toBeInTheDocument();
  });

  it('割り当て済みの音声タイプは aria-pressed=true になる', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro DEFAULT' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('バッジをクリックすると onToggleAudioType にそのタイプの id を渡す', async () => {
    const user = userEvent.setup();
    const onToggleAudioType = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={onToggleAudioType}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(2);
  });

  it('default 行でもバッジのクリックで onToggleAudioType が呼ばれる(タイプ変更のみ許可)', async () => {
    const user = userEvent.setup();
    const onToggleAudioType = vi.fn();
    render(
      <TrackRow
        track={defaultTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={onToggleAudioType}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'default_chime DEFAULT' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(1);
  });

  it('名前ボタンをクリックすると入力欄に切り替わり、値を変えてEnterするとonRenameが呼ばれる', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={onRename}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'new_name{Enter}');
    expect(onRename).toHaveBeenCalledWith('new_name');
  });

  it('名前を変えずに確定した場合は onRename を呼ばない', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={onRename}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('busy=true のときは名前ボタン・バッジ・削除ボタンが非活性', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro DEFAULT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeDisabled();
  });

  it('削除ボタンをクリックすると onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/TrackRow.test.tsx`
Expected: FAIL(`Cannot find module '@/components/TrackRow'`)

- [ ] **Step 3: 実装する**

`src/components/TrackRow.module.css`:

```css
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--grid-line);
}

.row:first-child {
  border-top: none;
}

.nameButton {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: none;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nameButton:hover:not(:disabled) {
  background: var(--accent-soft);
}

.nameButton:disabled {
  cursor: default;
  opacity: 0.7;
}

.nameLabel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 6px;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--ink-soft);
}

.nameInput {
  flex: 1;
  min-width: 0;
  font: inherit;
  font-size: 13.5px;
  font-weight: 600;
  padding: 4px 6px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: var(--panel);
  color: var(--ink);
}

.badges {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.badge {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 999px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--ink-faint);
  cursor: pointer;
  white-space: nowrap;
}

.badge:hover:not(:disabled) {
  border-color: var(--ink-faint);
}

.badge:disabled {
  cursor: default;
}

.badgeOn {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.deleteBtn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.deleteBtn:hover:not(:disabled) {
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-soft);
}

.deleteBtn:disabled {
  cursor: default;
  opacity: 0.6;
}

.lockIcon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 13px;
  color: var(--ink-faint);
}
```

`src/components/TrackRow.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { isEditableOrigin } from '@/lib/track-ui';
import type { Track, TrackAudioType } from '@/lib/types';
import styles from './TrackRow.module.css';

export interface TrackRowProps {
  track: Track;
  audioTypes: TrackAudioType[];
  busy: boolean;
  onRename: (name: string) => void;
  onToggleAudioType: (audioTypeId: number) => void;
  onDelete: () => void;
}

// 楽曲一覧の1行。origin が "user" の行のみ名前変更・削除ができる
// (画面詳細設計 4.2・6章)。音声タイプの割り当ては origin を問わず変更できる。
export function TrackRow({
  track,
  audioTypes,
  busy,
  onRename,
  onToggleAudioType,
  onDelete,
}: TrackRowProps) {
  const editable = isEditableOrigin(track.origin);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(track.name);

  function startEditing() {
    setDraftName(track.name);
    setEditing(true);
  }

  // Enter/フォーカスアウトで確定する。値が空・未変更なら何もしない
  // (失敗時は親が state を更新しないため、editing を閉じるだけで元の名前が再表示される)。
  function commitRename() {
    setEditing(false);
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === track.name) return;
    onRename(trimmed);
  }

  return (
    <div className={styles.row}>
      {editable && editing ? (
        <input
          type="text"
          className={styles.nameInput}
          aria-label="楽曲名"
          autoFocus
          disabled={busy}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      ) : editable ? (
        <button
          type="button"
          className={styles.nameButton}
          disabled={busy}
          aria-label={`${track.name}(クリックして名前を変更)`}
          onClick={startEditing}
        >
          {track.name}
        </button>
      ) : (
        <span className={styles.nameLabel}>{track.name}</span>
      )}

      <div className={styles.badges}>
        {audioTypes.map((type) => {
          const on = track.audioTypes.some((t) => t.id === type.id);
          return (
            <button
              key={type.id}
              type="button"
              className={on ? `${styles.badge} ${styles.badgeOn}` : styles.badge}
              aria-pressed={on}
              aria-label={`${track.name} ${type.name}`}
              disabled={busy}
              onClick={() => onToggleAudioType(type.id)}
            >
              {type.name}
            </button>
          );
        })}
      </div>

      {editable ? (
        <button
          type="button"
          className={styles.deleteBtn}
          aria-label={`${track.name} を削除`}
          disabled={busy}
          onClick={onDelete}
        >
          ✕
        </button>
      ) : (
        <span
          className={styles.lockIcon}
          aria-label="編集不可"
          title="初期音源・その他は名前変更・削除できません"
        >
          🔒
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/TrackRow.test.tsx`
Expected: PASS(9ケース)

- [ ] **Step 5: commit**

```bash
git add src/components/TrackRow.tsx src/components/TrackRow.module.css src/__tests__/components/TrackRow.test.tsx
git commit -m "feat: 楽曲一覧の1行(TrackRow)を実装"
```

---

## Task 8: `TrackSection` コンポーネント

**Files:**
- Create: `src/components/TrackSection.tsx`
- Create: `src/components/TrackSection.module.css`
- Test: `src/__tests__/components/TrackSection.test.tsx`

**Interfaces:**
- Consumes: `TrackRow`(Task 7、`@/components/TrackRow`)、`Track`・`TrackAudioType`(Task 1、`@/lib/types`)
- Produces: `TrackSectionProps { title: string; tracks: Track[]; audioTypes: TrackAudioType[]; emptyMessage: string; busyTrackId: number | null; onRename: (id: number, name: string) => void; onToggleAudioType: (id: number, audioTypeId: number) => void; onDelete: (id: number) => void }`、`TrackSection` コンポーネント。Task 9 がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/TrackSection.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackSection } from '@/components/TrackSection';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [{ id: 1, name: 'DEFAULT' }];

const tracks: Track[] = [
  { id: 1, name: 'chime_intro', filePath: '/x', origin: 'user', audioTypes: [] },
  { id: 2, name: 'school_bell', filePath: '/y', origin: 'user', audioTypes: [] },
];

describe('TrackSection', () => {
  it('見出しと各行を表示する', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'アップロード済み' })).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
    expect(screen.getByText('school_bell')).toBeInTheDocument();
  });

  it('楽曲が0件のときは emptyMessage を表示する', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={[]}
        audioTypes={audioTypes}
        emptyMessage="アップロード済みの楽曲はまだありません。"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('アップロード済みの楽曲はまだありません。')).toBeInTheDocument();
  });

  it('busyTrackId に一致する行だけ busy になる(削除ボタンが非活性)', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={2}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'school_bell を削除' })).toBeDisabled();
  });

  it('行の削除ボタンをクリックすると、その行の id で onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'school_bell を削除' }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/TrackSection.test.tsx`
Expected: FAIL(`Cannot find module '@/components/TrackSection'`)

- [ ] **Step 3: 実装する**

`src/components/TrackSection.module.css`:

```css
.section {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  margin-top: 20px;
  overflow: hidden;
}

.sectionTitle {
  font-family: var(--font-display);
  font-size: 14px;
  margin: 0;
  padding: 16px 16px 10px;
  color: var(--ink);
}

.emptyMessage {
  margin: 0;
  padding: 8px 16px 20px;
  font-size: 12.5px;
  color: var(--ink-faint);
}

.rows {
  padding-bottom: 4px;
}
```

`src/components/TrackSection.tsx`:

```tsx
'use client';

import { TrackRow } from './TrackRow';
import type { Track, TrackAudioType } from '@/lib/types';
import styles from './TrackSection.module.css';

export interface TrackSectionProps {
  title: string;
  tracks: Track[];
  audioTypes: TrackAudioType[];
  emptyMessage: string;
  busyTrackId: number | null;
  onRename: (id: number, name: string) => void;
  onToggleAudioType: (id: number, audioTypeId: number) => void;
  onDelete: (id: number) => void;
}

// 楽曲一覧の1セクション分(「アップロード済み」または「初期音源・その他」)。
// 行ごとの操作可否は TrackRow が origin を見て自分で判断する(画面詳細設計 4.2節)。
export function TrackSection({
  title,
  tracks,
  audioTypes,
  emptyMessage,
  busyTrackId,
  onRename,
  onToggleAudioType,
  onDelete,
}: TrackSectionProps) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {tracks.length === 0 ? (
        <p className={styles.emptyMessage}>{emptyMessage}</p>
      ) : (
        <div className={styles.rows}>
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              audioTypes={audioTypes}
              busy={track.id === busyTrackId}
              onRename={(name) => onRename(track.id, name)}
              onToggleAudioType={(audioTypeId) => onToggleAudioType(track.id, audioTypeId)}
              onDelete={() => onDelete(track.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/TrackSection.test.tsx`
Expected: PASS(4ケース)

- [ ] **Step 5: commit**

```bash
git add src/components/TrackSection.tsx src/components/TrackSection.module.css src/__tests__/components/TrackSection.test.tsx
git commit -m "feat: 楽曲一覧の1セクション(TrackSection)を実装"
```

---

## Task 9: `src/app/tracks/page.tsx`(画面本体)の実装

**Files:**
- Create: `src/app/tracks/page.tsx`
- Create: `src/app/tracks/page.module.css`
- Test: `src/__tests__/tracks-page.test.tsx`

**Interfaces:**
- Consumes: `NavSwitcher`(Task 4)、`UploadDropzone`(Task 6)、`TrackSection`(Task 8)、`ConfirmDialog`・`ErrorDialog`(Task 3 で `description` 対応済み)、`isEditableOrigin`・`sortTracksByName`・`toggleAudioTypeId`・`describeTrackError`(Task 2)、`Track`・`TrackAudioType`(Task 1)
- Produces: ルート `/tracks`。他タスクからの依存無し(末端)。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/tracks-page.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TracksPage from '@/app/tracks/page';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [
  { id: 1, name: 'DEFAULT' },
  { id: 2, name: 'NOTIFICATION' },
];

const userTrack: Track = {
  id: 1,
  name: 'chime_intro',
  filePath: '/data/sounds/user/chime_intro.wav',
  origin: 'user',
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

const defaultTrack: Track = {
  id: 2,
  name: 'default_chime',
  filePath: '/data/sounds/default/default_chime.wav',
  origin: 'default',
  audioTypes: [],
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body } as Response;
}

function noContentResponse(): Response {
  return { ok: true, status: 204, json: async () => ({}) } as Response;
}

function stubInitialLoad(fetchMock: ReturnType<typeof vi.fn>, tracks: Track[]) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ tracks }))
    .mockResolvedValueOnce(jsonResponse({ audioTypes }));
}

describe('楽曲管理画面', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('読み込み後、user 楽曲は「アップロード済み」、それ以外は「初期音源・その他」に表示する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack, defaultTrack]);
    vi.stubGlobal('fetch', fetchMock);

    render(<TracksPage />);

    expect(await screen.findByText('chime_intro')).toBeInTheDocument();
    const uploadedSection = screen.getByRole('heading', { name: 'アップロード済み' }).closest('section')!;
    const otherSection = screen
      .getByRole('heading', { name: '初期音源・その他(名前変更・削除不可)' })
      .closest('section')!;
    expect(uploadedSection).toHaveTextContent('chime_intro');
    expect(otherSection).toHaveTextContent('default_chime');
  });

  it('読み込みに失敗した場合はエラー表示にする', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);
    render(<TracksPage />);
    expect(
      await screen.findByText('読み込みに失敗しました。ページを再読み込みしてください。'),
    ).toBeInTheDocument();
  });

  it('アップロード成功時、一覧に新しい楽曲が追加される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const newTrack: Track = {
      id: 3,
      name: 'new_upload',
      filePath: '/data/sounds/user/new_upload.wav',
      origin: 'user',
      audioTypes: [],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: newTrack }, true, 201));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    const input = screen.getByLabelText('ファイルを選択');
    const file = new File([new Uint8Array(10)], 'new_upload.wav', { type: 'audio/wav' });
    await user.upload(input, file);

    expect(await screen.findByText('new_upload')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tracks', expect.objectContaining({ method: 'POST' }));
  });

  it('アップロードの拡張子エラーは ErrorDialog に表示される(クライアント側事前チェック)', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, new File(['x'], 'chime.mp3', { type: 'audio/mpeg' }));

    expect(await screen.findByText('アップロードに失敗しました')).toBeInTheDocument();
    expect(screen.getByText('.wav 形式のファイルのみアップロードできます。')).toBeInTheDocument();
    // アップロードの POST は呼ばれていない(初期読み込みの2回だけ)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('名前変更に成功すると一覧に反映される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const renamed: Track = { ...userTrack, name: 'renamed_chime' };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: renamed }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'renamed_chime{Enter}');

    expect(await screen.findByText('renamed_chime')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/tracks/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'renamed_chime', audioTypeIds: [1] }),
      }),
    );
  });

  it('名前変更に失敗すると ErrorDialog を表示し、名前は変わらない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'conflict', field: 'name' }, false, 409));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'dup_name{Enter}');

    expect(await screen.findByText('名前の変更に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('同じ表示名の楽曲が既に存在します。')).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
  });

  it('音声タイプを切り替えると現在の名前とともにPATCHし、一覧に反映される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const updated: Track = {
      ...userTrack,
      audioTypes: [
        { id: 1, name: 'DEFAULT' },
        { id: 2, name: 'NOTIFICATION' },
      ],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: updated }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/tracks/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'chime_intro', audioTypeIds: [1, 2] }),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('削除は確認ダイアログを経てから実行され、成功すると一覧から消える', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(noContentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    expect(screen.getByText('この操作は取り消せません。よろしいですか?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => expect(screen.queryByText('chime_intro')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tracks/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('削除に失敗すると ErrorDialog を表示し、一覧からは消えない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }, false, 403));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(await screen.findByText('削除に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/tracks-page.test.tsx`
Expected: FAIL(`Cannot find module '@/app/tracks/page'`)

- [ ] **Step 3: 実装する**

`src/app/tracks/page.module.css`:

```css
.app {
  min-height: 100vh;
}

.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px;
  background: var(--panel);
  border-bottom: 1px solid var(--panel-border);
}

.topbar h1 {
  font-family: var(--font-display);
  font-size: 17px;
  margin: 0;
}

.main {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
}

.loadingPanel {
  background: var(--panel);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow);
  padding: 70px 20px;
  text-align: center;
  color: var(--ink-soft);
  font-size: 13px;
}
```

`src/app/tracks/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { NavSwitcher } from '@/components/NavSwitcher';
import { UploadDropzone } from '@/components/UploadDropzone';
import { TrackSection } from '@/components/TrackSection';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorDialog } from '@/components/ErrorDialog';
import { describeTrackError, isEditableOrigin, sortTracksByName, toggleAudioTypeId } from '@/lib/track-ui';
import type { Track, TrackAudioType } from '@/lib/types';
import styles from './page.module.css';

type Phase = 'loading' | 'ready' | 'load-error';

interface ErrorState {
  message: string;
  description: string;
}

interface ConfirmState {
  trackId: number;
  trackName: string;
}

const NETWORK_ERROR_DESCRIPTION = 'サーバーとの通信でエラーが発生しました。';

// 楽曲管理画面(画面詳細設計 2026-07-29)。schedules.json と異なり db/music.sqlite3 は
// 常にバックエンド側で存在する前提のため、/ にある初期化ダイアログ相当のフェーズは持たない。
// 全操作を即時にサーバーへ反映する(保存ボタンを持たない)。
export default function TracksPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [tracks, setTracks] = useState<Track[]>([]);
  const [audioTypes, setAudioTypes] = useState<TrackAudioType[]>([]);
  const [busyTrackId, setBusyTrackId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tracksRes, audioTypesRes] = await Promise.all([
          fetch('/api/tracks'),
          fetch('/api/audio-types'),
        ]);
        if (!tracksRes.ok || !audioTypesRes.ok) throw new Error('load failed');
        const tracksJson = await tracksRes.json();
        const audioTypesJson = await audioTypesRes.json();
        if (cancelled) return;
        setTracks(tracksJson.tracks as Track[]);
        setAudioTypes(audioTypesJson.audioTypes as TrackAudioType[]);
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('load-error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function findTrack(id: number): Track | undefined {
    return tracks.find((t) => t.id === id);
  }

  async function handleRename(id: number, name: string) {
    const track = findTrack(id);
    if (!track) return;
    setBusyTrackId(id);
    try {
      const res = await fetch(`/api/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, audioTypeIds: track.audioTypes.map((a) => a.id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorState({ message: '名前の変更に失敗しました', description: describeTrackError(json) });
        return;
      }
      setTracks((prev) => prev.map((t) => (t.id === id ? (json.track as Track) : t)));
    } catch {
      setErrorState({ message: '名前の変更に失敗しました', description: NETWORK_ERROR_DESCRIPTION });
    } finally {
      setBusyTrackId(null);
    }
  }

  async function handleToggleAudioType(id: number, audioTypeId: number) {
    const track = findTrack(id);
    if (!track) return;
    const nextIds = toggleAudioTypeId(track.audioTypes.map((a) => a.id), audioTypeId);
    setBusyTrackId(id);
    try {
      const res = await fetch(`/api/tracks/${id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: track.name, audioTypeIds: nextIds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErrorState({ message: '音声タイプの変更に失敗しました', description: describeTrackError(json) });
        return;
      }
      setTracks((prev) => prev.map((t) => (t.id === id ? (json.track as Track) : t)));
    } catch {
      setErrorState({ message: '音声タイプの変更に失敗しました', description: NETWORK_ERROR_DESCRIPTION });
    } finally {
      setBusyTrackId(null);
    }
  }

  function handleRequestDelete(id: number) {
    const track = findTrack(id);
    if (!track) return;
    setConfirmState({ trackId: id, trackName: track.name });
  }

  async function handleConfirmDelete() {
    if (!confirmState) return;
    const { trackId } = confirmState;
    setConfirmState(null);
    setBusyTrackId(trackId);
    try {
      const res = await fetch(`/api/tracks/${trackId}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setErrorState({ message: '削除に失敗しました', description: describeTrackError(json) });
        return;
      }
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
    } catch {
      setErrorState({ message: '削除に失敗しました', description: NETWORK_ERROR_DESCRIPTION });
    } finally {
      setBusyTrackId(null);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.set('file', file);
      const res = await fetch('/api/tracks', { method: 'POST', body: form });
      const json = await res.json();
      if (!res.ok) {
        setErrorState({ message: 'アップロードに失敗しました', description: describeTrackError(json) });
        return;
      }
      setTracks((prev) => [...prev, json.track as Track]);
    } catch {
      setErrorState({ message: 'アップロードに失敗しました', description: NETWORK_ERROR_DESCRIPTION });
    } finally {
      setUploading(false);
    }
  }

  function handleValidationError(message: string) {
    setErrorState({ message: 'アップロードに失敗しました', description: message });
  }

  if (phase === 'loading') {
    return (
      <main className={styles.main}>
        <div className={styles.loadingPanel}>読み込み中...</div>
      </main>
    );
  }

  if (phase === 'load-error') {
    return (
      <main className={styles.main}>
        <div className={styles.loadingPanel}>
          読み込みに失敗しました。ページを再読み込みしてください。
        </div>
      </main>
    );
  }

  const userTracks = sortTracksByName(tracks.filter((t) => isEditableOrigin(t.origin)));
  const otherTracks = sortTracksByName(tracks.filter((t) => !isEditableOrigin(t.origin)));

  return (
    <div className={styles.app}>
      <header className={styles.topbar}>
        <h1>時報 設定</h1>
        <NavSwitcher current="tracks" />
      </header>
      <main className={styles.main}>
        <UploadDropzone
          uploading={uploading}
          onUpload={handleUpload}
          onValidationError={handleValidationError}
        />
        <TrackSection
          title="アップロード済み"
          tracks={userTracks}
          audioTypes={audioTypes}
          emptyMessage="アップロード済みの楽曲はまだありません。上のエリアから .wav をアップロードしてください。"
          busyTrackId={busyTrackId}
          onRename={handleRename}
          onToggleAudioType={handleToggleAudioType}
          onDelete={handleRequestDelete}
        />
        <TrackSection
          title="初期音源・その他(名前変更・削除不可)"
          tracks={otherTracks}
          audioTypes={audioTypes}
          emptyMessage="初期音源はありません。"
          busyTrackId={busyTrackId}
          onRename={handleRename}
          onToggleAudioType={handleToggleAudioType}
          onDelete={handleRequestDelete}
        />
      </main>
      <ConfirmDialog
        open={confirmState !== null}
        title={`${confirmState?.trackName ?? ''}を削除`}
        message="この操作は取り消せません。よろしいですか?"
        actionLabel="削除する"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmState(null)}
      />
      <ErrorDialog
        open={errorState !== null}
        message={errorState?.message ?? ''}
        description={errorState?.description}
        onClose={() => setErrorState(null)}
      />
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/tracks-page.test.tsx`
Expected: PASS(9ケース)

- [ ] **Step 5: 全体テストを実行して既存分含めて green を確認する**

Run: `pnpm test`
Expected: PASS(全ファイル)

- [ ] **Step 6: commit**

```bash
git add src/app/tracks/page.tsx src/app/tracks/page.module.css src/__tests__/tracks-page.test.tsx
git commit -m "feat: 楽曲管理画面(/tracks)の画面本体を実装"
```

---

## Task 10: E2E シナリオの実装

**Files:**
- Create: `e2e/track-management.spec.ts`

**Interfaces:**
- Consumes: 実装済みの `/tracks` 画面一式(Task 1〜9)。devcontainer がバインドマウントする実 `db/music.sqlite3`・`sounds/`(既に `DEFAULT`/`NOTIFICATION`/`ALARM` の `audio_types` がシードされている前提。`e2e/schedule-editing.spec.ts` が実 `settings/schedules.json` に依存しているのと同じ前提)。

- [ ] **Step 1: シナリオを書く**

`e2e/track-management.spec.ts`:

```ts
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
```

- [ ] **Step 2: 実行して成功を確認する**

Run: `pnpm test:e2e -- e2e/track-management.spec.ts`
Expected: PASS

- [ ] **Step 3: commit**

```bash
git add e2e/track-management.spec.ts
git commit -m "test: 楽曲管理画面のE2E主要シナリオを追加"
```

---

## Task 11: タスク管理ドキュメントの更新

**Files:**
- Create: `tasks/implementation/008-ui-track-management.md`
- Modify: `tasks/TASKS.md`

**Interfaces:** 無し(ドキュメントのみ)。本タスクは Task 1〜10 が全て完了した後に行う。

- [ ] **Step 1: 実装記録ファイルを作成する**

`tasks/implementation/008-ui-track-management.md`:

```md
# 008: 楽曲管理画面(`/tracks`)の実装

- ステータス: 完了
- 関連文書: [楽曲管理画面(`/tracks`)画面詳細設計](../../docs/superpowers/specs/2026-07-29-music-management-screen-design.md)

## 概要

データ層・API(`/api/tracks`・`/api/tracks/:id`・`/api/audio-types`。楽曲管理機能
概要設計書に基づき実装済み)の上に、`/tracks` 画面を実装した。全操作を即時に
サーバーへ反映する方式とし、`src/app/page.tsx`(スケジュール設定画面)との間を
ヘッダーのアイコン切替(`NavSwitcher`)で行き来できるようにした。

## 完了条件

- [x] `/tracks` にアクセスすると、`user` 楽曲は「アップロード済み」、
      `default`/`unknown` 楽曲は「初期音源・その他(名前変更・削除不可)」に
      分けて表示される
- [x] 常設ドロップゾーンから `.wav` をアップロードすると一覧に即時反映される
      (複数ファイル同時ドロップ・拡張子違反・10MB超はクライアント側で弾く)
- [x] `user` 楽曲の名前をインライン編集すると即時に `PATCH` される
- [x] 音声タイプのバッジをクリックすると即時に `PATCH` される
      (`origin` を問わず操作できる)
- [x] `user` 楽曲の削除は既存の `ConfirmDialog` での確認を経てから `DELETE` される
- [x] 各操作の失敗は既存の `ErrorDialog`(`description` prop を追加して汎用化)で表示される
- [x] ヘッダーの `NavSwitcher`(🕐/🎵)で `/` と `/tracks` を行き来できる
- [x] `pnpm test` で green(コンポーネント: `TrackRow`・`TrackSection`・
      `UploadDropzone`・`NavSwitcher`・`track-ui`・`ErrorDialog` 追加分・
      `tracks/page`。既存 `page.test.tsx` も引き続き green)
- [x] `pnpm test:e2e` で green(楽曲管理の主要シナリオ1本を追加)
```

- [ ] **Step 2: `tasks/TASKS.md` を更新する**

`tasks/TASKS.md` の「実装」セクション末尾(`implementation/007` の行の後)に追加:

```md
- [x] [implementation/008](./implementation/008-ui-track-management.md) 楽曲管理画面(`/tracks`)の実装 — 完了
```

- [ ] **Step 3: 全体の型チェック・テストを最終確認する**

Run: `pnpm exec tsc --noEmit && pnpm test && pnpm test:e2e`
Expected: 全て green

- [ ] **Step 4: commit**

```bash
git add tasks/TASKS.md tasks/implementation/008-ui-track-management.md
git commit -m "docs: 楽曲管理画面(/tracks)実装をTASKS.mdに反映"
```
