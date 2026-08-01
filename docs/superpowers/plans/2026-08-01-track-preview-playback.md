# 楽曲試し聴き機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tracks` 画面の各行に再生ボタンを追加し、登録済みの `.wav` をブラウザ上でその場で試し聴きできるようにする。

**Architecture:** 新規 `GET /api/tracks/:id/audio` が DB の `filePath` からファイルを読み `audio/wav` として返す。`TracksPage` が非表示の `<audio>` 要素を1つだけ保持し、どの行の再生ボタンを押してもその1要素を使い回す(同時に鳴るのは常に1曲)。`TrackRow`/`TrackSection` は `playing`/`onTogglePlay` を親から受け取って表示・中継するだけの薄い層。

**Tech Stack:** Next.js App Router(Route Handlers)、React、Vitest + React Testing Library、next-test-api-route-handler、Playwright。既存の `track-store.ts`(Drizzle ORM + `node:sqlite`)を再利用。

## Global Constraints

- 配信エンドポイントは `GET /api/tracks/:id/audio`、レスポンスは `Content-Type: audio/wav` でファイル本体をそのまま返す(Rangeヘッダ非対応。毎回全体を返す)
- `Content-Disposition` は付けない(ダウンロードではなく再生用途)
- `id` が数値でない → 400 `{ error: 'invalid_id' }` / DBに存在しない → 404 `{ error: 'not_found' }` / DBにはあるがファイルが `ENOENT` → 404 `{ error: 'file_not_found' }` / その他I/Oエラー → 500 `{ error: 'io_error' }`
- 再生は `origin`(`default`/`user`/`unknown`)を問わず許可する(名前変更・削除の権限チェックとは独立)
- 再生ボタンは既存の `busy`(PATCH/DELETE進行中)による無効化の対象にしない。再生中でも他の操作(名前変更・削除・タイプ切替え)は一切制限しない
- UIは▶(停止中)/⏸(再生中)の28×28pxボタンを行の先頭(名前の左)に配置し、枠線は常に表示したまま、再生中は行全体を`var(--accent-soft)`でハイライトする(ブレインストーミングで確定した「A+Cハイブリッド」案)
- 再生失敗時は既存の `ErrorDialog` を再利用し「再生に失敗しました」+ 既存の `NETWORK_ERROR_DESCRIPTION` を表示する
- 参照元設計書: `docs/superpowers/specs/2026-08-01-track-preview-playback-design.md`

---

## Task 1: `track-store.ts` に `getTrackFilePathOrThrow` を追加

**Files:**
- Modify: `src/lib/track-store.ts`
- Test: `src/lib/track-store.test.ts`

**Interfaces:**
- Consumes: 既存の `getDb()`(`./db/client`)、`wavTracks`(`./db/generated/schema`)、`eq`(`drizzle-orm`)、既存の `TrackNotFoundError`
- Produces: `export function getTrackFilePathOrThrow(id: number): string`(存在しなければ `TrackNotFoundError` を投げる)。Task 2 の Route Handler がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/lib/track-store.test.ts` の `describe('deleteTrack', ...)` ブロックの直後(411行目の `describe('file_path のDB制約...')` の直前)に以下を追加する:

```ts
describe('getTrackFilePathOrThrow', () => {
  it('存在するidはfilePathを返す', () => {
    seed();
    const chime = listTracks().find((t) => t.name === 'my_chime')!;
    expect(getTrackFilePathOrThrow(chime.id)).toBe(chime.filePath);
  });

  it('存在しないidはTrackNotFoundErrorを投げる', () => {
    seed();
    expect(() => getTrackFilePathOrThrow(9999)).toThrow(TrackNotFoundError);
  });
});
```

同ファイル冒頭の import 文を以下のように変更し、`getTrackFilePathOrThrow` を追加する:

```ts
import {
  listTracks,
  listAudioTypes,
  updateTrack,
  createTrackFromUpload,
  deleteTrack,
  getTrackFilePathOrThrow,
  InvalidFileNameError,
  TrackConflictError,
  InvalidAudioTypeError,
  TrackNotFoundError,
  DefaultTrackForbiddenError,
} from './track-store';
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run src/lib/track-store.test.ts -t getTrackFilePathOrThrow`
Expected: FAIL(`getTrackFilePathOrThrow is not a function` 相当のエラー)

- [ ] **Step 3: 最小実装を書く**

`src/lib/track-store.ts` の `getTrackByIdOrThrow` 関数(165〜169行目)の直後に追加する:

```ts
// 試し聴き用に filePath だけを返す(試し聴き機能 詳細設計 2.3節)。
// updateTrack・deleteTrack と異なり origin による権限チェックは行わない
// (再生は origin を問わず許可する方針のため)。
export function getTrackFilePathOrThrow(id: number): string {
  const current = getDb().select().from(wavTracks).where(eq(wavTracks.id, id)).get();
  if (!current) throw new TrackNotFoundError(id);
  return current.filePath;
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run src/lib/track-store.test.ts`
Expected: PASS(全テスト)

- [ ] **Step 5: コミット**

```bash
git add src/lib/track-store.ts src/lib/track-store.test.ts
git commit -m "feat: track-store に getTrackFilePathOrThrow を追加"
```

---

## Task 2: 音声配信 API `GET /api/tracks/:id/audio`

**Files:**
- Create: `src/app/api/tracks/[id]/audio/route.ts`
- Create: `src/app/api/tracks/[id]/audio/route.test.ts`

**Interfaces:**
- Consumes: Task 1 の `getTrackFilePathOrThrow(id: number): string`、`TrackNotFoundError`(`@/lib/track-store`)
- Produces: `GET /api/tracks/:id/audio` エンドポイント。Task 6(TracksPage)がこの URL を `<audio src>` に設定する。

- [ ] **Step 1: 失敗するテストを書く**

`src/app/api/tracks/[id]/audio/route.test.ts` を新規作成:

```ts
// @vitest-environment node
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { testApiHandler } from 'next-test-api-route-handler';
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import * as appHandler from './route';
import { getTrackFilePathOrThrow, TrackNotFoundError } from '@/lib/track-store';

vi.mock('@/lib/track-store', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/track-store')>();
  return { ...actual, getTrackFilePathOrThrow: vi.fn() };
});

const mockGetPath = getTrackFilePathOrThrow as unknown as Mock;

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'track-audio-'));
  vi.clearAllMocks();
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

describe('GET /api/tracks/:id/audio', () => {
  it('200でファイル本体を audio/wav として返す', async () => {
    const filePath = path.join(tmpDir, 'sample.wav');
    await writeFile(filePath, Buffer.from('RIFF-dummy-wav-bytes'));
    mockGetPath.mockReturnValue(filePath);

    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toBe('audio/wav');
        const body = Buffer.from(await res.arrayBuffer());
        expect(body.toString()).toBe('RIFF-dummy-wav-bytes');
      },
    });
  });

  it('idが数値でなければ400 invalid_id', async () => {
    await testApiHandler({
      appHandler,
      params: { id: 'abc' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: 'invalid_id' });
      },
    });
  });

  it('TrackNotFoundErrorは404 not_found', async () => {
    mockGetPath.mockImplementation(() => {
      throw new TrackNotFoundError(1);
    });
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'not_found' });
      },
    });
  });

  it('DBにはあるが実ファイルが無い場合は404 file_not_found', async () => {
    mockGetPath.mockReturnValue(path.join(tmpDir, 'missing.wav'));
    await testApiHandler({
      appHandler,
      params: { id: '1' },
      test: async ({ fetch }) => {
        const res = await fetch({ method: 'GET' });
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: 'file_not_found' });
      },
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run src/app/api/tracks/[id]/audio/route.test.ts`
Expected: FAIL(`route.ts` が存在せず import エラー)

- [ ] **Step 3: 最小実装を書く**

`src/app/api/tracks/[id]/audio/route.ts` を新規作成:

```ts
import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { getTrackFilePathOrThrow, TrackNotFoundError } from '@/lib/track-store';

// ファイル I/O を行うため Node.js ランタイムで動かす。
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteParams = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = Number(idParam);
  return Number.isInteger(id) ? id : null;
}

// GET /api/tracks/:id/audio
// 試し聴き用に .wav 本体をそのまま返す(試し聴き機能 詳細設計 2章)。
// Rangeヘッダ非対応、毎回ファイル全体を返す。
export async function GET(_request: Request, { params }: RouteParams): Promise<NextResponse> {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (id === null) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let filePath: string;
  try {
    filePath = getTrackFilePathOrThrow(id);
  } catch (err) {
    if (err instanceof TrackNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }

  try {
    const buffer = await readFile(path.resolve(filePath));
    return new NextResponse(buffer, {
      status: 200,
      headers: { 'content-type': 'audio/wav' },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'file_not_found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'io_error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run src/app/api/tracks/[id]/audio/route.test.ts`
Expected: PASS(全4件)

- [ ] **Step 5: コミット**

```bash
git add src/app/api/tracks/[id]/audio/route.ts src/app/api/tracks/[id]/audio/route.test.ts
git commit -m "feat: GET /api/tracks/:id/audio で試し聴き用の音声配信APIを追加"
```

---

## Task 3: `TrackRow` に再生ボタンを追加

**Files:**
- Modify: `src/components/TrackRow.tsx`
- Modify: `src/components/TrackRow.module.css`
- Modify: `src/__tests__/components/TrackRow.test.tsx`

**Interfaces:**
- Consumes: なし(このタスク単体で完結)
- Produces: `TrackRowProps` に `playing: boolean`・`onTogglePlay: () => void` を追加。Task 4(`TrackSection`)がこれらを渡す。

- [ ] **Step 1: 失敗するテストを書く(既存テストをヘルパー化しつつ新規ケースを追加)**

`src/__tests__/components/TrackRow.test.tsx` の内容を丸ごと以下に置き換える(既存ケースは `renderRow` ヘルパー経由に書き換え、末尾に再生ボタンのケースを追加):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackRow, type TrackRowProps } from '@/components/TrackRow';
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

function renderRow(overrides: Partial<TrackRowProps> = {}) {
  const props: TrackRowProps = {
    track: userTrack,
    audioTypes,
    busy: false,
    playing: false,
    onRename: () => {},
    onToggleAudioType: () => {},
    onDelete: () => {},
    onTogglePlay: () => {},
    ...overrides,
  };
  return render(<TrackRow {...props} />);
}

describe('TrackRow', () => {
  it('origin=user の行は名前ボタン・削除ボタンを表示する', () => {
    renderRow({ track: userTrack });
    expect(
      screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeInTheDocument();
  });

  it('origin=default の行は名前がラベル表示になり、削除ボタンの代わりに🔒を表示する', () => {
    renderRow({ track: defaultTrack });
    expect(screen.queryByRole('button', { name: /クリックして名前を変更/ })).not.toBeInTheDocument();
    expect(screen.getByText('default_chime')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /を削除/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('編集不可')).toBeInTheDocument();
  });

  it('割り当て済みの音声タイプは aria-pressed=true になる', () => {
    renderRow({ track: userTrack });
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
    renderRow({ track: userTrack, onToggleAudioType });
    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(2);
  });

  it('default 行でもバッジのクリックで onToggleAudioType が呼ばれる(タイプ変更のみ許可)', async () => {
    const user = userEvent.setup();
    const onToggleAudioType = vi.fn();
    renderRow({ track: defaultTrack, onToggleAudioType });
    await user.click(screen.getByRole('button', { name: 'default_chime DEFAULT' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(1);
  });

  it('名前ボタンをクリックすると入力欄に切り替わり、値を変えてEnterするとonRenameが呼ばれる', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderRow({ track: userTrack, onRename });
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'new_name{Enter}');
    expect(onRename).toHaveBeenCalledWith('new_name');
  });

  it('名前を変えずに確定した場合は onRename を呼ばない', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    renderRow({ track: userTrack, onRename });
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('busy=true のときは名前ボタン・バッジ・削除ボタンが非活性', () => {
    renderRow({ track: userTrack, busy: true });
    expect(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro DEFAULT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeDisabled();
  });

  it('削除ボタンをクリックすると onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderRow({ track: userTrack, onDelete });
    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('停止中は▶ボタンを表示し、クリックすると onTogglePlay を呼ぶ', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    renderRow({ track: userTrack, playing: false, onTogglePlay });
    const playButton = screen.getByRole('button', { name: 'chime_intro を再生' });
    expect(playButton).toHaveTextContent('▶');
    await user.click(playButton);
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('再生中は⏸ボタンを表示し、クリックすると onTogglePlay を呼ぶ', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    renderRow({ track: userTrack, playing: true, onTogglePlay });
    const stopButton = screen.getByRole('button', { name: 'chime_intro を停止' });
    expect(stopButton).toHaveTextContent('⏸');
    await user.click(stopButton);
    expect(onTogglePlay).toHaveBeenCalled();
  });

  it('busy=true でも再生ボタンは活性のまま', () => {
    renderRow({ track: userTrack, busy: true, playing: false });
    expect(screen.getByRole('button', { name: 'chime_intro を再生' })).toBeEnabled();
  });

  it('origin=default の行でも再生ボタンを表示する', () => {
    renderRow({ track: defaultTrack, playing: false });
    expect(screen.getByRole('button', { name: 'default_chime を再生' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run src/__tests__/components/TrackRow.test.tsx`
Expected: FAIL(`playing`/`onTogglePlay` が `TrackRowProps` に無い旨の型エラー、または再生ボタンが見つからず `getByRole` が失敗)

- [ ] **Step 3: 最小実装を書く**

`src/components/TrackRow.tsx` を以下の内容に置き換える:

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
  playing: boolean;
  onRename: (name: string) => void;
  onToggleAudioType: (audioTypeId: number) => void;
  onDelete: () => void;
  onTogglePlay: () => void;
}

// 楽曲一覧の1行。origin が "user" の行のみ名前変更・削除ができる
// (画面詳細設計 4.2・6章)。音声タイプの割り当ては origin を問わず変更できる。
// 再生ボタンは origin・busy に関係なく常に操作できる(試し聴き機能 詳細設計 3.4節)。
export function TrackRow({
  track,
  audioTypes,
  busy,
  playing,
  onRename,
  onToggleAudioType,
  onDelete,
  onTogglePlay,
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
    <div className={playing ? `${styles.row} ${styles.rowPlaying}` : styles.row}>
      <button
        type="button"
        className={playing ? `${styles.playBtn} ${styles.playBtnPlaying}` : styles.playBtn}
        aria-label={playing ? `${track.name} を停止` : `${track.name} を再生`}
        onClick={onTogglePlay}
      >
        {playing ? '⏸' : '▶'}
      </button>

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

`src/components/TrackRow.module.css` の末尾(131行目の後)に以下を追加する:

```css

.playBtn {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  border: 1px solid var(--panel-border);
  background: transparent;
  color: var(--ink-faint);
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.playBtn:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}

.playBtnPlaying {
  background: var(--panel);
  border-color: var(--accent);
  color: var(--accent-ink);
}

.rowPlaying {
  background: var(--accent-soft);
}

.rowPlaying .nameLabel,
.rowPlaying .nameButton {
  color: var(--accent-ink);
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run src/__tests__/components/TrackRow.test.tsx`
Expected: PASS(全14件)

- [ ] **Step 5: コミット**

```bash
git add src/components/TrackRow.tsx src/components/TrackRow.module.css src/__tests__/components/TrackRow.test.tsx
git commit -m "feat: TrackRow に再生ボタンを追加"
```

---

## Task 4: `TrackSection` に再生状態の中継を追加

**Files:**
- Modify: `src/components/TrackSection.tsx`
- Modify: `src/__tests__/components/TrackSection.test.tsx`

**Interfaces:**
- Consumes: Task 3 の `TrackRowProps`(`playing`・`onTogglePlay`)
- Produces: `TrackSectionProps` に `playingTrackId: number | null`・`onTogglePlay: (id: number) => void` を追加。Task 5(`TracksPage`)がこれらを渡す。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/TrackSection.test.tsx` の内容を丸ごと以下に置き換える:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackSection, type TrackSectionProps } from '@/components/TrackSection';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [{ id: 1, name: 'DEFAULT' }];

const tracks: Track[] = [
  { id: 1, name: 'chime_intro', filePath: '/x', origin: 'user', audioTypes: [] },
  { id: 2, name: 'school_bell', filePath: '/y', origin: 'user', audioTypes: [] },
];

function renderSection(overrides: Partial<TrackSectionProps> = {}) {
  const props: TrackSectionProps = {
    title: 'アップロード済み',
    tracks,
    audioTypes,
    emptyMessage: 'ありません',
    busyTrackIds: new Set(),
    playingTrackId: null,
    onRename: () => {},
    onToggleAudioType: () => {},
    onDelete: () => {},
    onTogglePlay: () => {},
    ...overrides,
  };
  return render(<TrackSection {...props} />);
}

describe('TrackSection', () => {
  it('見出しと各行を表示する', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'アップロード済み' })).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
    expect(screen.getByText('school_bell')).toBeInTheDocument();
  });

  it('楽曲が0件のときは emptyMessage を表示する', () => {
    renderSection({ tracks: [], emptyMessage: 'アップロード済みの楽曲はまだありません。' });
    expect(screen.getByText('アップロード済みの楽曲はまだありません。')).toBeInTheDocument();
  });

  it('busyTrackIds に含まれる行だけ busy になる(削除ボタンが非活性)', () => {
    renderSection({ busyTrackIds: new Set([2]) });
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'school_bell を削除' })).toBeDisabled();
  });

  it('行の削除ボタンをクリックすると、その行の id で onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderSection({ onDelete });
    await user.click(screen.getByRole('button', { name: 'school_bell を削除' }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it('playingTrackId と一致する行だけ再生中(⏸)表示になる', () => {
    renderSection({ playingTrackId: 2 });
    expect(screen.getByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'school_bell を停止' })).toBeInTheDocument();
  });

  it('行の再生ボタンをクリックすると、その行の id で onTogglePlay を呼ぶ', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    renderSection({ onTogglePlay });
    await user.click(screen.getByRole('button', { name: 'school_bell を再生' }));
    expect(onTogglePlay).toHaveBeenCalledWith(2);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run src/__tests__/components/TrackSection.test.tsx`
Expected: FAIL(`playingTrackId`/`onTogglePlay` が `TrackSectionProps` に無い旨のエラー、または `TrackRow` に必須propが渡らず型エラー)

- [ ] **Step 3: 最小実装を書く**

`src/components/TrackSection.tsx` を以下の内容に置き換える:

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
  busyTrackIds: ReadonlySet<number>;
  playingTrackId: number | null;
  onRename: (id: number, name: string) => void;
  onToggleAudioType: (id: number, audioTypeId: number) => void;
  onDelete: (id: number) => void;
  onTogglePlay: (id: number) => void;
}

// 楽曲一覧の1セクション分(「アップロード済み」または「初期音源・その他」)。
// 行ごとの操作可否は TrackRow が origin を見て自分で判断する(画面詳細設計 4.2節)。
export function TrackSection({
  title,
  tracks,
  audioTypes,
  emptyMessage,
  busyTrackIds,
  playingTrackId,
  onRename,
  onToggleAudioType,
  onDelete,
  onTogglePlay,
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
              busy={busyTrackIds.has(track.id)}
              playing={track.id === playingTrackId}
              onRename={(name) => onRename(track.id, name)}
              onToggleAudioType={(audioTypeId) => onToggleAudioType(track.id, audioTypeId)}
              onDelete={() => onDelete(track.id)}
              onTogglePlay={() => onTogglePlay(track.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run src/__tests__/components/TrackSection.test.tsx`
Expected: PASS(全6件)

- [ ] **Step 5: コミット**

```bash
git add src/components/TrackSection.tsx src/__tests__/components/TrackSection.test.tsx
git commit -m "feat: TrackSection に再生状態の中継を追加"
```

---

## Task 5: `TracksPage` に共有プレイヤーを配線する

**Files:**
- Modify: `src/app/tracks/page.tsx`
- Modify: `src/__tests__/tracks-page.test.tsx`

**Interfaces:**
- Consumes: Task 2 の `GET /api/tracks/:id/audio`、Task 4 の `TrackSectionProps`(`playingTrackId`・`onTogglePlay`)
- Produces: なし(末端のページコンポーネント)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/tracks-page.test.tsx` の `describe('楽曲管理画面', () => {` の直後(41〜43行目、既存の `afterEach` の直後)に `beforeEach` を追加し、`<audio>` の `play`/`pause` を jsdom 用にモックする:

```ts
describe('楽曲管理画面', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

ファイル末尾(271行目、最後の `});` の直前)に以下のテストを追加する:

```ts

  it('再生ボタンをクリックすると音声を再生し、アイコンが⏸に切り替わる', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const playSpy = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = playSpy;

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));

    expect(playSpy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'chime_intro を停止' })).toBeInTheDocument();
    const audio = screen.getByTestId('track-preview-audio') as HTMLAudioElement;
    expect(audio.src).toContain('/api/tracks/1/audio');
  });

  it('再生中に同じ行のボタンをクリックすると停止する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const pauseSpy = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseSpy;

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    await screen.findByRole('button', { name: 'chime_intro を停止' });
    await user.click(screen.getByRole('button', { name: 'chime_intro を停止' }));

    expect(pauseSpy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
  });

  it('再生エラー時は ErrorDialog を表示し、再生中状態を解除する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    const audio = screen.getByTestId('track-preview-audio');
    audio.dispatchEvent(new Event('error'));

    expect(await screen.findByText('再生に失敗しました')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `pnpm exec vitest run src/__tests__/tracks-page.test.tsx`
Expected: FAIL(再生ボタンが見つからない = `TrackSection` に渡す props が未実装のため `getByRole('button', { name: 'chime_intro を再生' })` が失敗、または `getByTestId('track-preview-audio')` が見つからない)

- [ ] **Step 3: 最小実装を書く**

`src/app/tracks/page.tsx` の import 文(3行目)を変更する:

```tsx
import { useEffect, useRef, useState } from 'react';
```

37行目(`const [errorState, setErrorState] = useState<ErrorState | null>(null);`)の直後に状態を追加する:

```tsx
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
```

`handleValidationError` 関数(165〜167行目)の直後にハンドラを追加する:

```tsx
  function handleValidationError(message: string) {
    setErrorState({ message: 'アップロードに失敗しました', description: message });
  }

  // 単一の <audio> 要素を全行で共有し、同時に鳴るのは常に1曲までにする
  // (試し聴き機能 詳細設計 3.1節)。
  function handleTogglePlay(id: number) {
    const audio = audioRef.current;
    if (!audio) return;
    if (playingId === id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    audio.src = `/api/tracks/${id}/audio`;
    setPlayingId(id);
    audio.play().catch(() => {
      // 失敗時の表示は <audio> の onError(handlePlaybackError)に一本化する
    });
  }

  function handlePlaybackEnded() {
    setPlayingId(null);
  }

  function handlePlaybackError() {
    setPlayingId(null);
    setErrorState({ message: '再生に失敗しました', description: NETWORK_ERROR_DESCRIPTION });
  }
```

「アップロード済み」の `<TrackSection>`(214〜223行目)を以下に置き換える:

```tsx
        <TrackSection
          title="アップロード済み"
          tracks={userTracks}
          audioTypes={audioTypes}
          emptyMessage="アップロード済みの楽曲はまだありません。上のエリアから .wav をアップロードしてください。"
          busyTrackIds={busyTrackIds}
          playingTrackId={playingId}
          onRename={handleRename}
          onToggleAudioType={handleToggleAudioType}
          onDelete={handleRequestDelete}
          onTogglePlay={handleTogglePlay}
        />
```

「初期音源・その他」の `<TrackSection>`(224〜233行目)を以下に置き換える:

```tsx
        <TrackSection
          title="初期音源・その他(名前変更・削除不可)"
          tracks={otherTracks}
          audioTypes={audioTypes}
          emptyMessage="初期音源はありません。"
          busyTrackIds={busyTrackIds}
          playingTrackId={playingId}
          onRename={handleRename}
          onToggleAudioType={handleToggleAudioType}
          onDelete={handleRequestDelete}
          onTogglePlay={handleTogglePlay}
        />
```

`</main>` の直後(234行目)、`<ConfirmDialog` の直前に `<audio>` 要素を追加する:

```tsx
      </main>
      <audio
        ref={audioRef}
        data-testid="track-preview-audio"
        hidden
        onEnded={handlePlaybackEnded}
        onError={handlePlaybackError}
      />
      <ConfirmDialog
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `pnpm exec vitest run src/__tests__/tracks-page.test.tsx`
Expected: PASS(全13件)

続けて型チェックと全体テストも流す:

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し

Run: `pnpm test`
Expected: 既存分も含め全件 PASS

- [ ] **Step 5: コミット**

```bash
git add src/app/tracks/page.tsx src/__tests__/tracks-page.test.tsx
git commit -m "feat: TracksPage に共有プレイヤーを配線し試し聴きを可能にする"
```

---

## Task 6: E2Eシナリオに試し聴きのステップを追加

**Files:**
- Modify: `e2e/track-management.spec.ts`

**Interfaces:**
- Consumes: Task 5 までの完成した `/tracks` 画面(実際に動く devcontainer の `db/music.sqlite3`・`sounds/user/` を使う)
- Produces: なし(最終確認シナリオ)

- [ ] **Step 1: シナリオにアサーションを追加する(このタスクはE2Eなので「先に失敗を見る」ステップを兼ねる)**

`e2e/track-management.spec.ts` の 17行目、アップロード用ファイルの中身を実際に再生可能な最小WAVに差し替える。まず import 文の直後(4行目の後)にWAV生成用のヘルパー関数を追加する:

```ts
import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// ブラウザで実際に再生可能な最小の PCM WAV(8kHz・8bit・モノラル・0.1秒の無音)を生成する。
// アップロード自体の検証には中身は関係ないが、試し聴きシナリオでは実際にデコードできる
// 必要があるため、以前のダミーバイト列(非WAV形式)から差し替える。
function buildMinimalWavBuffer(): Buffer {
  const sampleRate = 8000;
  const numSamples = Math.floor(sampleRate * 0.1);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + numSamples, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(numSamples, 40);
  const data = Buffer.alloc(numSamples, 0x80);
  return Buffer.concat([header, data]);
}
```

17行目の `await writeFile(filePath, Buffer.from('RIFF----WAVEfmt dummy-content-for-e2e-test'));` を以下に置き換える:

```ts
    await writeFile(filePath, buildMinimalWavBuffer());
```

`notificationBadge` のアサーション(36〜38行目)の直後、削除ステップ(40行目)の直前に試し聴きのステップを追加する:

```ts
      const playButton = page.getByRole('button', { name: `${trackName} を再生` });
      const audioRequest = page.waitForRequest((req) => req.url().includes(`/api/tracks/${trackId}/audio`));
      await playButton.click();
      await audioRequest;
      await expect(page.getByRole('button', { name: `${trackName} を停止` })).toBeVisible();
      await page.getByRole('button', { name: `${trackName} を停止` }).click();
      await expect(page.getByRole('button', { name: `${trackName} を再生` })).toBeVisible();
```

- [ ] **Step 2: テストを実行して通ることを確認する**

Run: `pnpm test:e2e e2e/track-management.spec.ts`
Expected: PASS(devcontainer 上で `pnpm dev` 相当のサーバーが起動できる環境が前提。既存シナリオ同様、実 `db/music.sqlite3`・`sounds/user/` を使う)

- [ ] **Step 3: コミット**

```bash
git add e2e/track-management.spec.ts
git commit -m "test: 楽曲管理E2Eシナリオに試し聴きのステップを追加"
```

---

## 完了確認

全タスク完了後、以下を通しで実行して最終確認する:

```bash
pnpm exec tsc --noEmit
pnpm test
pnpm test:e2e
```

`tasks/TASKS.md` は本機能追加のタスクIDを持たない(design/implementation/deployの全項目は既に完了済みの状態への追加機能のため)。更新が必要な場合はユーザーに確認する。
