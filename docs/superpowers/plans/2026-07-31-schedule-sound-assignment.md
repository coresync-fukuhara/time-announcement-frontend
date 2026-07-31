# スケジュール画面からの音設定(minute_settings)Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** スケジュール画面(`/`)の各ON分に対して、曲(`sound_file_name`)またはタイプ(`sound_types`)を割り当てられるようにする。

**Architecture:** `src/lib/schedule-ui.ts` に純粋関数を4つ追加し、`TimeGrid.tsx` の既存スタブ(バッジ)を実配線、新規 `SoundAssignDialog` でモード選択(未設定/曲を指定/タイプで指定)を行う。保存は既存の「保存」ボタン方式にそのまま乗せる(ダイアログの「適用」はクライアント側状態を更新するだけ)。型・`settings/schema.json`・`/api/schedules` の BFF・`validator.ts` は無改修。

**Tech Stack:** Next.js App Router(Client Components)・React 19・Vitest + React Testing Library。新規の外部依存追加は無し。

**関連文書:** [スケジュール画面からの音設定 詳細設計](../specs/2026-07-31-schedule-sound-assignment-design.md)

## Global Constraints

- 保存モデルは既存のスケジュール画面(明示的な「保存」ボタン)にそのまま合わせる。`SoundAssignDialog` の「適用」はクライアント側 `EditableSchedules` 状態を更新するのみで、`PUT /api/schedules` は呼ばない(詳細設計 5章)。
- `sound_file_name` が非空なら最優先、`sound_types` は無視される(詳細設計 2章、`src/main.py` 実機確認済み)。この優先順位を `getMinuteSound` の判定順序に反映する。
- 「曲を指定」モードで保存する値は `{ sound_file_name: <選択した楽曲名> }`。`sound_types` キーは書き込まない。
- 「タイプで指定」モードで保存する値は `{ sound_file_name: '', sound_types: [...] }`(空文字は schema 上 `type: string` のみで妥当。詳細設計 4章)。
- `sound_types` は `DEFAULT`・`NOTIFICATION`・`ALARM` の順(`settings/schema.json` の定義順)で正規化して保存する。選択順序に依存させない。
- 「未設定」を選ぶと、その分の `minute_settings` キー自体を削除する(`clearMinuteSound`)。
- `/api/tracks` はダイアログを開いたとき(`open` が true になったとき)にのみ取得する。ページ読み込み時には取得しない。
- 楽曲取得に失敗しても「タイプで指定」「未設定」は使える(部分的な機能低下に留める)。
- 現在の値(`sound_file_name`)が取得した楽曲一覧に存在しない場合も選択肢として保持し、黙って消さない。
- OFF の分にはバッジを表示しない。閲覧モード(`viewMode`)ではバッジをクリックできない(`disabled`)。
- 型(`src/lib/types.ts`)・`settings/schema.json`・`src/lib/validator.ts`・`/api/schedules` の Route Handler は変更しない。

---

## Task 1: `src/lib/schedule-ui.ts` に音設定用の純粋関数を追加

**Files:**
- Modify: `src/lib/schedule-ui.ts`
- Modify: `src/__tests__/schedule-ui.test.ts`

**Interfaces:**
- Consumes: `HourEntry`・`AudioType`(既存、`@/lib/types`)
- Produces: `MinuteSoundState`(`{ mode: 'none' } | { mode: 'track'; name: string } | { mode: 'types'; types: AudioType[] }`)、`getMinuteSound(entry, minute)`、`setMinuteSoundTrack(entry, minute, trackName)`、`setMinuteSoundTypes(entry, minute, types)`、`clearMinuteSound(entry, minute)`。Task 2・3・4 がこれらを import する。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/schedule-ui.test.ts` の末尾(`describe('diffHourMinutes', ...)` ブロックの後)に追加:

```ts
import {
  getMinuteSound,
  setMinuteSoundTrack,
  setMinuteSoundTypes,
  clearMinuteSound,
} from '@/lib/schedule-ui';

describe('getMinuteSound', () => {
  it('minute_settings が無ければ none', () => {
    expect(getMinuteSound({ hour: 9, minutes: [0] }, 0)).toEqual({ mode: 'none' });
  });

  it('sound_file_name が非空なら track(sound_types があっても track を優先する)', () => {
    const entry = {
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample', sound_types: ['ALARM'] as const } },
    };
    expect(getMinuteSound(entry, 0)).toEqual({ mode: 'track', name: 'sample' });
  });

  it('sound_file_name が空文字で sound_types があれば types', () => {
    const entry = {
      hour: 9,
      minutes: [30],
      minute_settings: { '30': { sound_file_name: '', sound_types: ['DEFAULT', 'ALARM'] as const } },
    };
    expect(getMinuteSound(entry, 30)).toEqual({ mode: 'types', types: ['DEFAULT', 'ALARM'] });
  });

  it('sound_file_name が空文字で sound_types も無ければ none', () => {
    const entry = { hour: 9, minutes: [0], minute_settings: { '0': { sound_file_name: '' } } };
    expect(getMinuteSound(entry, 0)).toEqual({ mode: 'none' });
  });

  it('他の分の設定には影響されない', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    };
    expect(getMinuteSound(entry, 30)).toEqual({ mode: 'none' });
  });
});

describe('setMinuteSoundTrack', () => {
  it('指定した分に sound_file_name をセットする', () => {
    const entry = { hour: 9, minutes: [0] };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    });
  });

  it('既存の sound_types は除去する', () => {
    const entry = {
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: '', sound_types: ['ALARM'] as const } },
    };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    });
  });

  it('他の分の minute_settings は温存する', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' } },
    };
    expect(setMinuteSoundTrack(entry, 0, 'sample')).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' }, '0': { sound_file_name: 'sample' } },
    });
  });
});

describe('setMinuteSoundTypes', () => {
  it('指定した分に sound_file_name: "" と sound_types をセットする', () => {
    const entry = { hour: 9, minutes: [30] };
    expect(setMinuteSoundTypes(entry, 30, ['DEFAULT', 'ALARM'])).toEqual({
      hour: 9,
      minutes: [30],
      minute_settings: { '30': { sound_file_name: '', sound_types: ['DEFAULT', 'ALARM'] } },
    });
  });
});

describe('clearMinuteSound', () => {
  it('指定した分の minute_settings キーを削除する', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' }, '30': { sound_file_name: 'other' } },
    };
    expect(clearMinuteSound(entry, 0)).toEqual({
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '30': { sound_file_name: 'other' } },
    });
  });

  it('対象の分に設定が無ければ何もしない(同じ内容を返す)', () => {
    const entry = { hour: 9, minutes: [0] };
    expect(clearMinuteSound(entry, 0)).toEqual({ hour: 9, minutes: [0] });
  });

  it('minutes など他フィールドは変更しない', () => {
    const entry = {
      hour: 9,
      minutes: [0, 30],
      minute_settings: { '0': { sound_file_name: 'sample' } },
    };
    expect(clearMinuteSound(entry, 0)).toEqual({ hour: 9, minutes: [0, 30] });
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/schedule-ui.test.ts`
Expected: FAIL(`getMinuteSound` などが `@/lib/schedule-ui` に存在しない)

- [ ] **Step 3: 実装する**

`src/lib/schedule-ui.ts` の先頭 import 部分を変更:

```ts
import type { AudioType, DaySchedule, HourEntry, Schedules, Weekday } from './types';
```

ファイル末尾(`diffHourMinutes` 関数の後)に追加:

```ts
// スケジュール画面から曲/タイプを割り当てる機能(minute_settings の編集)。
// バックエンド(別リポジトリの src/main.py)の優先順位に合わせ、sound_file_name が
// 非空なら track、そうでなく sound_types があれば types、どちらも無ければ none とする
// (詳細設計 2章)。
export type MinuteSoundState =
  | { mode: 'none' }
  | { mode: 'track'; name: string }
  | { mode: 'types'; types: AudioType[] };

export function getMinuteSound(entry: HourEntry, minute: number): MinuteSoundState {
  const setting = entry.minute_settings?.[String(minute)];
  if (!setting) return { mode: 'none' };
  if (setting.sound_file_name) return { mode: 'track', name: setting.sound_file_name };
  if (setting.sound_types && setting.sound_types.length > 0) {
    return { mode: 'types', types: setting.sound_types };
  }
  return { mode: 'none' };
}

// 指定した分以外(hour・minutes・他の分の minute_settings)には触れない(toggleMinute と同じ方針)。
export function setMinuteSoundTrack(entry: HourEntry, minute: number, trackName: string): HourEntry {
  return {
    ...entry,
    minute_settings: {
      ...entry.minute_settings,
      [String(minute)]: { sound_file_name: trackName },
    },
  };
}

export function setMinuteSoundTypes(entry: HourEntry, minute: number, types: AudioType[]): HourEntry {
  return {
    ...entry,
    minute_settings: {
      ...entry.minute_settings,
      [String(minute)]: { sound_file_name: '', sound_types: types },
    },
  };
}

export function clearMinuteSound(entry: HourEntry, minute: number): HourEntry {
  if (!entry.minute_settings || !(String(minute) in entry.minute_settings)) return entry;
  const nextSettings = { ...entry.minute_settings };
  delete nextSettings[String(minute)];
  return { ...entry, minute_settings: nextSettings };
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/schedule-ui.test.ts`
Expected: PASS(既存ケース+新規13ケース)

- [ ] **Step 5: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し

- [ ] **Step 6: commit**

```bash
git add src/lib/schedule-ui.ts src/__tests__/schedule-ui.test.ts
git commit -m "feat: minute_settingsの曲/タイプ割り当て用の純粋関数を追加"
```

---

## Task 2: `SoundAssignDialog` コンポーネント

**Files:**
- Create: `src/components/SoundAssignDialog.tsx`
- Create: `src/components/SoundAssignDialog.module.css`
- Test: `src/__tests__/components/SoundAssignDialog.test.tsx`

**Interfaces:**
- Consumes: `MinuteSoundState`(Task 1、`@/lib/schedule-ui`)、`AudioType`(既存、`@/lib/types`)、既存 `dialog.module.css`
- Produces: `SoundAssignDialogProps { open: boolean; hour: number; minute: number; current: MinuteSoundState; onApply: (next: MinuteSoundState) => void; onClose: () => void }`、`SoundAssignDialog` コンポーネント。Task 4 がこれを使う。

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/components/SoundAssignDialog.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoundAssignDialog } from '@/components/SoundAssignDialog';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const noop = () => {};

describe('SoundAssignDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('open=false のときは何も表示しない', () => {
    render(
      <SoundAssignDialog
        open={false}
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('開くと現在の状態(none)でモード「未設定」が選ばれた状態になり、楽曲一覧を取得する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }] }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('dialog', { name: '音の割り当て' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未設定' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tracks'));
  });

  it('current が track のとき、開いた時点で「曲を指定」モードかつ選択済みになる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }, { name: 'chime' }] })),
    );
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'track', name: 'sample' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '曲を指定' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByLabelText('曲を選択')).toHaveValue('sample'));
  });

  it('現在の曲が取得した一覧に無くても選択肢として保持する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'chime' }] })));
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'track', name: 'deleted_track' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('曲を選択')).toHaveValue('deleted_track'));
    expect(screen.getByText('deleted_track(現在DBに見つかりません)')).toBeInTheDocument();
  });

  it('current が types のとき、開いた時点で「タイプで指定」モードかつ選択済みになる', () => {
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={30}
        current={{ mode: 'types', types: ['DEFAULT', 'ALARM'] }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'タイプで指定' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'NOTIFICATION' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'ALARM' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('「曲を指定」で未選択のうちは適用ボタンが非活性', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }] })));
    const user = userEvent.setup();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('曲を選んで適用すると onApply({ mode: "track", name }) を呼ぶ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }, { name: 'chime' }] })),
    );
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    await screen.findByLabelText('曲を選択');
    await user.selectOptions(screen.getByLabelText('曲を選択'), 'chime');
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'track', name: 'chime' });
  });

  it('タイプを0件選択の状態では適用ボタンが非活性', async () => {
    const user = userEvent.setup();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('タイプを選んで適用すると、選択順によらずDEFAULT/NOTIFICATION/ALARM順で onApply を呼ぶ', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: 'DEFAULT' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'types', types: ['DEFAULT', 'ALARM'] });
  });

  it('「未設定」を選んで適用すると onApply({ mode: "none" }) を呼ぶ(常に活性)', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'types', types: ['ALARM'] }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '未設定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'none' });
  });

  it('楽曲一覧の取得に失敗しても「タイプで指定」は使える', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    await screen.findByText('曲一覧の取得に失敗しました。');
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'types', types: ['ALARM'] });
  });

  it('キャンセルを押すと onClose を呼び、onApply は呼ばない', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/SoundAssignDialog.test.tsx`
Expected: FAIL(`Cannot find module '@/components/SoundAssignDialog'`)

- [ ] **Step 3: 実装する**

`src/components/SoundAssignDialog.module.css`:

```css
.modeChips {
  display: flex;
  gap: 6px;
  margin: 4px 0 20px;
}

.modeChip {
  flex: 1;
  font-size: 12.5px;
  font-weight: 600;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--bg);
  color: var(--ink-soft);
  cursor: pointer;
}

.modeChip:hover {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.modeChip[aria-pressed='true'] {
  background: var(--accent);
  color: #062a38;
  border-color: var(--accent);
  font-weight: 700;
}

.section {
  margin-bottom: 20px;
}

.section select {
  width: 100%;
  font: inherit;
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel);
  color: var(--ink);
}

.typeChips {
  display: flex;
  gap: 6px;
}

.typeChip {
  flex: 1;
  font-family: var(--font-mono);
  font-size: 11.5px;
  font-weight: 700;
  padding: 8px 4px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--bg);
  color: var(--ink-soft);
  cursor: pointer;
}

.typeChip[aria-pressed='true'] {
  background: var(--accent-soft);
  color: var(--accent-ink);
  border-color: var(--accent);
}

.error {
  font-size: 12.5px;
  color: var(--danger);
  margin: 0;
}
```

`src/components/SoundAssignDialog.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { AudioType } from '@/lib/types';
import type { MinuteSoundState } from '@/lib/schedule-ui';
import { pad2 } from '@/lib/schedule-ui';
import dialogStyles from './dialog.module.css';
import styles from './SoundAssignDialog.module.css';

export interface SoundAssignDialogProps {
  open: boolean;
  hour: number;
  minute: number;
  current: MinuteSoundState;
  onApply: (next: MinuteSoundState) => void;
  onClose: () => void;
}

const AUDIO_TYPES: AudioType[] = ['DEFAULT', 'NOTIFICATION', 'ALARM'];

type Mode = MinuteSoundState['mode'];

// スケジュール画面の各ON分に曲/タイプを割り当てるダイアログ(詳細設計 3.2節)。
// 保存はしない(適用でクライアント側状態を返すのみ。実際のPUTは既存の「保存」ボタンまで待つ)。
export function SoundAssignDialog({
  open,
  hour,
  minute,
  current,
  onApply,
  onClose,
}: SoundAssignDialogProps) {
  const [mode, setMode] = useState<Mode>('none');
  const [trackName, setTrackName] = useState('');
  const [types, setTypes] = useState<AudioType[]>([]);
  const [tracks, setTracks] = useState<string[] | null>(null);
  const [tracksError, setTracksError] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(current.mode);
    setTrackName(current.mode === 'track' ? current.name : '');
    setTypes(current.mode === 'types' ? current.types : []);
    setTracks(null);
    setTracksError(false);

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/tracks');
        if (!res.ok) throw new Error('failed to load tracks');
        const json = await res.json();
        if (!cancelled) {
          setTracks((json.tracks as { name: string }[]).map((t) => t.name));
        }
      } catch {
        if (!cancelled) setTracksError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // current は open が true になった瞬間の初期値としてのみ使う(以降は自分の state で管理する)。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  function toggleType(type: AudioType) {
    setTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : AUDIO_TYPES.filter((t) => prev.includes(t) || t === type),
    );
  }

  const canApply =
    mode === 'none' ||
    (mode === 'track' && trackName !== '') ||
    (mode === 'types' && types.length > 0);

  function handleApply() {
    if (!canApply) return;
    if (mode === 'none') onApply({ mode: 'none' });
    else if (mode === 'track') onApply({ mode: 'track', name: trackName });
    else onApply({ mode: 'types', types });
  }

  const trackOptions = tracks ?? [];
  const hasUnknownCurrentTrack = trackName !== '' && !trackOptions.includes(trackName);

  return (
    <div className={dialogStyles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={dialogStyles.dialog} role="dialog" aria-label="音の割り当て">
        <h2>
          {hour}時{pad2(minute)}分の音
        </h2>
        <p>この分に鳴らす音を選択してください</p>

        <div className={styles.modeChips}>
          <button
            type="button"
            className={styles.modeChip}
            aria-pressed={mode === 'none'}
            onClick={() => setMode('none')}
          >
            未設定
          </button>
          <button
            type="button"
            className={styles.modeChip}
            aria-pressed={mode === 'track'}
            onClick={() => setMode('track')}
          >
            曲を指定
          </button>
          <button
            type="button"
            className={styles.modeChip}
            aria-pressed={mode === 'types'}
            onClick={() => setMode('types')}
          >
            タイプで指定
          </button>
        </div>

        {mode === 'track' &&
          (tracksError ? (
            <div className={styles.section}>
              <p className={styles.error}>曲一覧の取得に失敗しました。</p>
            </div>
          ) : (
            <div className={styles.section}>
              <select
                aria-label="曲を選択"
                value={trackName}
                onChange={(e) => setTrackName(e.target.value)}
              >
                <option value="">選択してください</option>
                {hasUnknownCurrentTrack && (
                  <option value={trackName}>{trackName}(現在DBに見つかりません)</option>
                )}
                {trackOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          ))}

        {mode === 'types' && (
          <div className={styles.section}>
            <div className={styles.typeChips}>
              {AUDIO_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={styles.typeChip}
                  aria-pressed={types.includes(type)}
                  onClick={() => toggleType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={dialogStyles.dialogActions}>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnGhost}`}
            onClick={onClose}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
            disabled={!canApply}
            onClick={handleApply}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/SoundAssignDialog.test.tsx`
Expected: PASS(13ケース)

- [ ] **Step 5: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し

- [ ] **Step 6: commit**

```bash
git add src/components/SoundAssignDialog.tsx src/components/SoundAssignDialog.module.css src/__tests__/components/SoundAssignDialog.test.tsx
git commit -m "feat: 音の割り当てダイアログ(SoundAssignDialog)を実装"
```

---

## Task 3: `TimeGrid.tsx` へのバッジ配線

**Files:**
- Modify: `src/components/TimeGrid.tsx`
- Modify: `src/components/TimeGrid.module.css`
- Modify: `src/__tests__/components/TimeGrid.test.tsx`
- Modify: `src/app/page.tsx`(`TimeGrid` の新しい必須 prop を満たすための一時的な no-op 配線のみ。実際の配線は Task 4)

**Interfaces:**
- Consumes: `getMinuteSound`(Task 1、`@/lib/schedule-ui`)
- Produces: `TimeGridProps` に `onRequestAssignSound: (hour: number, minute: number) => void` を追加。Task 4 がこれを使う。

`TimeGridProps` に必須 prop を追加すると、既存の呼び出し元 `src/app/page.tsx` がその場で型エラーになる。Task 3 と Task 4 を完全に独立させる(それぞれの commit で `tsc --noEmit` が通る状態を保つ)ため、本タスクの最後に `page.tsx` 側は一時的な no-op(`() => {}`)だけを渡す。実際のダイアログ配線・state 追加は Task 4 で行う。

- [ ] **Step 1: 失敗するテストを追加する**

`src/__tests__/components/TimeGrid.test.tsx` の `makeHours` の後、`const noop = () => {};` の前に追加:

```tsx
function makeHoursWithSound(): HourMap {
  return {
    9: {
      hour: 9,
      minutes: [0, 30],
      minute_settings: {
        '0': { sound_file_name: 'sample' },
        '30': { sound_file_name: '', sound_types: ['ALARM'] },
      },
    },
  };
}
```

同ファイルの `describe('TimeGrid', ...)` 内、既存の全 `<TimeGrid ...>` 呼び出しに `onRequestAssignSound={noop}` prop を追加する(既存8箇所すべて)。加えて、最後の `it` の後に新規テストを追加:

```tsx
  it('ONの分にのみ音バッジを表示し、状態に応じてラベルが変わる(No.13関連: 詳細設計3.1節)', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHoursWithSound()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分: 曲「sample」(クリックで変更)' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '9時30分: タイプ ALARM(クリックで変更)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '9時05分の音を割り当てる' })).not.toBeInTheDocument();
  });

  it('未設定のONの分は「音を割り当てる」ラベルのバッジを表示する', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分の音を割り当てる' })).toBeInTheDocument();
  });

  it('バッジをクリックすると onRequestAssignSound(hour, minute) を呼ぶ', async () => {
    const user = userEvent.setup();
    const onRequestAssignSound = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={onRequestAssignSound}
      />,
    );
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    expect(onRequestAssignSound).toHaveBeenCalledWith(9, 0);
  });

  it('閲覧モードではバッジが非活性になる', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分の音を割り当てる' })).toBeDisabled();
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/components/TimeGrid.test.tsx`
Expected: FAIL(バッジが存在しない/`onRequestAssignSound` が無い、の複合エラー)

- [ ] **Step 3: 実装する**

`src/components/TimeGrid.module.css` の末尾(`.songBadgeAssigned` の後)に追加:

```css
.songBadgeTypes {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent-ink);
}
```

`src/components/TimeGrid.tsx:1-15` の import・Props を変更:

```tsx
'use client';

import { getMinuteSound, MINUTES, pad2 } from '@/lib/schedule-ui';
import type { HourMap } from '@/lib/schedule-ui';
import styles from './TimeGrid.module.css';

export interface TimeGridProps {
  dayLabel: string;
  hours: HourMap;
  viewMode: boolean;
  onToggleMinute: (hour: number, minute: number) => void;
  onRequestDeleteHour: (hour: number) => void;
  onRequestAddHour: () => void;
  onRequestCopy: () => void;
  onRequestAssignSound: (hour: number, minute: number) => void;
}
```

`src/components/TimeGrid.tsx` の関数シグネチャ(`export function TimeGrid({ ... })`)に `onRequestAssignSound` を追加:

```tsx
export function TimeGrid({
  dayLabel,
  hours,
  viewMode,
  onToggleMinute,
  onRequestDeleteHour,
  onRequestAddHour,
  onRequestCopy,
  onRequestAssignSound,
}: TimeGridProps) {
```

`src/components/TimeGrid.tsx:65-103` の分ボタン部分(`{MINUTES.map((m) => { ... })}`、既存のコメントアウトされたスタブを含む)を全体置き換え:

```tsx
                  {MINUTES.map((m) => {
                    const on = activeMinutes.includes(m);
                    const sound = getMinuteSound(hours[hour], m);
                    const badgeClass =
                      sound.mode === 'track'
                        ? `${styles.songBadge} ${styles.songBadgeAssigned}`
                        : sound.mode === 'types'
                          ? `${styles.songBadge} ${styles.songBadgeTypes}`
                          : styles.songBadge;
                    const badgeLabel =
                      sound.mode === 'track'
                        ? `${hour}時${pad2(m)}分: 曲「${sound.name}」(クリックで変更)`
                        : sound.mode === 'types'
                          ? `${hour}時${pad2(m)}分: タイプ ${sound.types.join('・')}(クリックで変更)`
                          : `${hour}時${pad2(m)}分の音を割り当てる`;
                    return (
                      <div key={m} className={styles.lampCell}>
                        <button
                          type="button"
                          className={styles.lamp}
                          aria-pressed={on}
                          aria-label={`${hour}時${pad2(m)}分`}
                          disabled={viewMode}
                          onClick={() => onToggleMinute(hour, m)}
                        />
                        {on && (
                          <button
                            type="button"
                            className={badgeClass}
                            aria-label={badgeLabel}
                            disabled={viewMode}
                            onClick={() => onRequestAssignSound(hour, m)}
                          >
                            ♪
                          </button>
                        )}
                      </div>
                    );
                  })}
```

`src/app/page.tsx` の `<TimeGrid ... />` 呼び出し(`onRequestCopy={() => setCopyOpen(true)}` の行の直後)に、一時的な no-op を1行追加(Task 4 で本物の配線に置き換える):

```tsx
        <TimeGrid
          dayLabel={dayLabel(currentDay)}
          hours={hours}
          viewMode={viewMode}
          onToggleMinute={handleToggleMinute}
          onRequestDeleteHour={handleRequestDeleteHour}
          onRequestAddHour={() => setAddHourOpen(true)}
          onRequestCopy={() => setCopyOpen(true)}
          onRequestAssignSound={() => {}}
        />
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/components/TimeGrid.test.tsx`
Expected: PASS(既存8ケース+新規4ケース)

Run: `pnpm test -- src/__tests__/page.test.tsx`
Expected: PASS(既存5ケース。バッジが増えても既存アサーションは名前で厳密一致しているため影響しない)

- [ ] **Step 5: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し

- [ ] **Step 6: commit**

```bash
git add src/components/TimeGrid.tsx src/components/TimeGrid.module.css src/__tests__/components/TimeGrid.test.tsx src/app/page.tsx
git commit -m "feat: TimeGridに音バッジを配線する"
```

---

## Task 4: `src/app/page.tsx` への組み込み

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/__tests__/page.test.tsx`

**Interfaces:**
- Consumes: `SoundAssignDialog`(Task 2)、`getMinuteSound`・`setMinuteSoundTrack`・`setMinuteSoundTypes`・`clearMinuteSound`・`MinuteSoundState`(Task 1)、`TimeGrid` の新 prop `onRequestAssignSound`(Task 3)

- [ ] **Step 1: 失敗するテストを書く**

`src/__tests__/page.test.tsx` の末尾(最後の `it` の後、`});` の前)に追加:

```tsx

  it('分バッジでタイプを指定すると保存時にminute_settingsへ反映される', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ tracks: [] }))
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    await screen.findByRole('dialog', { name: '音の割り当て' });
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(screen.queryByRole('dialog', { name: '音の割り当て' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '9時00分: タイプ ALARM(クリックで変更)' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByRole('button', { name: '編集' });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/schedules' && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.monday[0].minute_settings).toEqual({
      '0': { sound_file_name: '', sound_types: ['ALARM'] },
    });
  });

  it('ダイアログをキャンセルしても未保存インジケーターは出ない', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ tracks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    await screen.findByRole('dialog', { name: '音の割り当て' });
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog', { name: '音の割り当て' })).not.toBeInTheDocument();
    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `pnpm test -- src/__tests__/page.test.tsx`
Expected: FAIL(新規2ケースのみ。「9時00分の音を割り当てる」ボタンが存在しない)

- [ ] **Step 3: 実装する**

`src/app/page.tsx:1-27` の import 部分を変更:

```tsx
'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DayTabs } from '@/components/DayTabs';
import { TimeGrid } from '@/components/TimeGrid';
import { InitDialog, type InitChoice } from '@/components/InitDialog';
import { AddHourDialog } from '@/components/AddHourDialog';
import { CopyDialog } from '@/components/CopyDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorDialog } from '@/components/ErrorDialog';
import { CopyDiff } from '@/components/CopyDiff';
import { NavSwitcher } from '@/components/NavSwitcher';
import { SoundAssignDialog } from '@/components/SoundAssignDialog';
import {
  DAY_TABS,
  dayLabel,
  toEditableSchedules,
  fromEditableSchedules,
  emptyEditableSchedules,
  toggleMinute,
  copyDay,
  diffHourMinutes,
  getMinuteSound,
  setMinuteSoundTrack,
  setMinuteSoundTypes,
  clearMinuteSound,
  type EditableSchedules,
  type HourMap,
  type MinuteSoundState,
} from '@/lib/schedule-ui';
import type { Weekday, Schedules } from '@/lib/types';
import styles from './page.module.css';
import shellStyles from '@/components/screen-shell.module.css';
```

`src/app/page.tsx:54-57`(ダイアログ系 state 宣言)を変更:

```tsx
  const [addHourOpen, setAddHourOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [soundAssignTarget, setSoundAssignTarget] = useState<{ hour: number; minute: number } | null>(
    null,
  );
```

`src/app/page.tsx` の `handleRequestCopy` 関数の後(`handleSave` 関数の前)に追加:

```tsx
  function handleApplySound(next: MinuteSoundState) {
    if (!soundAssignTarget) return;
    const { hour, minute } = soundAssignTarget;
    const entry = hours[hour];
    if (!entry) return;
    const updatedEntry =
      next.mode === 'none'
        ? clearMinuteSound(entry, minute)
        : next.mode === 'track'
          ? setMinuteSoundTrack(entry, minute, next.name)
          : setMinuteSoundTypes(entry, minute, next.types);
    updateDay(currentDay, { ...hours, [hour]: updatedEntry });
    setDirty(true);
    setSoundAssignTarget(null);
  }
```

`src/app/page.tsx` の `<TimeGrid ... />` 呼び出し内、Task 3 で追加した一時的な no-op を本物の配線に置き換える:

```diff
-          onRequestAssignSound={() => {}}
+          onRequestAssignSound={(hour, minute) => setSoundAssignTarget({ hour, minute })}
```

`src/app/page.tsx` の `<ErrorDialog ... />` の直後(`</div>` の前)に追加:

```tsx
      <SoundAssignDialog
        open={soundAssignTarget !== null}
        hour={soundAssignTarget?.hour ?? 0}
        minute={soundAssignTarget?.minute ?? 0}
        current={soundAssignTarget ? getMinuteSound(hours[soundAssignTarget.hour], soundAssignTarget.minute) : { mode: 'none' }}
        onApply={handleApplySound}
        onClose={() => setSoundAssignTarget(null)}
      />
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `pnpm test -- src/__tests__/page.test.tsx`
Expected: PASS(既存5ケース+新規2ケース)

- [ ] **Step 5: 全テスト・型チェックを実行する**

Run: `pnpm test`
Expected: 全ファイルPASS

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し

- [ ] **Step 6: commit**

```bash
git add src/app/page.tsx src/__tests__/page.test.tsx
git commit -m "feat: スケジュール画面に音の割り当てダイアログを組み込む"
```

---

## 完了条件チェックリスト(詳細設計との対応)

- [x] Task 1: データ/ロジック層(詳細設計 4章)
- [x] Task 2: `SoundAssignDialog`(詳細設計 3.2章)
- [x] Task 3: バッジ配置(詳細設計 3.1章)
- [x] Task 4: 保存タイミング(詳細設計 5章。既存の保存ボタンにそのまま統合、`copyDay` は無改修のまま音設定もコピー対象になることを Task 4 のテストでは直接検証していないが、`copyDay` 自体は Task 1 着手前から `minute_settings` を含めて深いクローンをしており、詳細設計時点で確認済みのため追加改修・追加テストは不要)
- [x] スコープ外(詳細設計 7章): 時間行レベルの既定値・一括適用・0件警告・ALARM データ不整合対応・`audio_types` マスタ編集は、いずれも本計画のどのタスクにも含まれていない
