# 曲指定UIをラジオボタン+originグループ分けに変更する Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `SoundAssignDialog`の「曲を指定」モードの選択UIを、ネイティブ`<select>`ドロップダウンから、origin(`default`/`user`/`unknown`)別にグループ分けされた縦並びのラジオボタンリストに置き換える。

**Architecture:** `SoundAssignDialog.tsx`内でのみ完結する表示ロジックの変更。`/api/tracks`から取得するデータに`origin`フィールドを追加で保持し、`src/lib/track-ui.ts`の既存`isEditableOrigin`関数(`/tracks`画面で使われているものと同一)でグループ分けする。選択は常に1つ(バックエンド`sound_file_name`が単一文字列のため)で、`MinuteSoundState`型・`canApply`ロジック・`onApply`のシグネチャは変更しない。

**Tech Stack:** Next.js (App Router) / React / TypeScript、Vitest + React Testing Library + `@testing-library/user-event`、CSS Modules。

## Global Constraints

- データ層(`src/lib/schedule-ui.ts`)・`/api/schedules`・`/api/tracks`・`settings/schema.json`は無改修(設計書4章・[docs/superpowers/specs/2026-08-01-track-select-radio-list-design.md](../../../docs/superpowers/specs/2026-08-01-track-select-radio-list-design.md)4章)
- 複数曲の同時指定はスコープ外(バックエンド`sound_file_name`が単一文字列のため実現不可、design/006 §2で確認済み)
- テストは既存の3層ピラミッドのうちコンポーネント層のみ変更。API/E2E層への追加・変更は無し(設計書5章)
- `/tracks`画面(`src/app/tracks/page.tsx`)側は無改修。グループ判定ロジック(`isEditableOrigin`)を流用するのみ

---

### Task 1: `SoundAssignDialog`の「曲を指定」UIをラジオボタン+originグループ分けに変更する

**Files:**
- Modify: `src/components/SoundAssignDialog.tsx`
- Modify: `src/components/SoundAssignDialog.module.css`
- Test: `src/__tests__/components/SoundAssignDialog.test.tsx`

**Interfaces:**
- Consumes: `isEditableOrigin(origin: TrackOrigin): boolean`(`src/lib/track-ui.ts`、既存・変更なし)、`TrackOrigin = 'default' | 'user' | 'unknown'`(`src/lib/types.ts`、既存・変更なし)、`MinuteSoundState`(`src/lib/schedule-ui.ts`、既存・変更なし)
- Produces: `SoundAssignDialogProps`は変更なし(`onApply: (next: MinuteSoundState) => void`のシグネチャは維持)。この Task の外からは見た目の変更のみで、他コンポーネント(`TimeGrid.tsx`・`page.tsx`)からの呼び出し方は一切変わらない

- [ ] **Step 1: テストファイルを新しい仕様(ラジオボタン + originグループ分け)に全面的に書き換える**

`src/__tests__/components/SoundAssignDialog.test.tsx` を以下の内容で完全に置き換える。

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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample', origin: 'default' }] }));
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
      vi.fn().mockResolvedValue(
        jsonResponse({
          tracks: [
            { name: 'sample', origin: 'default' },
            { name: 'chime', origin: 'default' },
          ],
        }),
      ),
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
    await waitFor(() => expect(screen.getByRole('radio', { name: 'sample' })).toBeChecked());
    expect(screen.getByRole('radio', { name: 'chime' })).not.toBeChecked();
  });

  it('現在の曲が取得した一覧に無くても選択肢として保持し、単独行としてグループの外に表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'chime', origin: 'user' }] })),
    );
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
    const radio = await screen.findByRole('radio', { name: 'deleted_track(現在DBに見つかりません)' });
    expect(radio).toBeChecked();
    const list = screen.getByRole('radiogroup', { name: '曲を選択' });
    expect(list.textContent).toBe('deleted_track(現在DBに見つかりません)アップロード済みchime');
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample', origin: 'default' }] })),
    );
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
      vi.fn().mockResolvedValue(
        jsonResponse({
          tracks: [
            { name: 'sample', origin: 'default' },
            { name: 'chime', origin: 'default' },
          ],
        }),
      ),
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
    await user.click(await screen.findByRole('radio', { name: 'chime' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'track', name: 'chime' });
  });

  it('origin別にグループ見出しが表示され、各グループ内は名前順になる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          tracks: [
            { name: 'zzz_track', origin: 'user' },
            { name: 'mystery', origin: 'unknown' },
            { name: 'chime', origin: 'user' },
            { name: 'apple_sound', origin: 'default' },
          ],
        }),
      ),
    );
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
    await screen.findByRole('radio', { name: 'chime' });
    const list = screen.getByRole('radiogroup', { name: '曲を選択' });
    expect(list.textContent).toBe('アップロード済みchimezzz_track初期音源・その他apple_soundmystery');
  });

  it('あるグループが0件のときは見出しごと非表示にする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample', origin: 'default' }] })),
    );
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
    await screen.findByRole('radio', { name: 'sample' });
    expect(screen.queryByText('アップロード済み')).not.toBeInTheDocument();
    expect(screen.getByText('初期音源・その他')).toBeInTheDocument();
  });

  it('別グループの曲を選ぶと元の選択が外れる(単一選択)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          tracks: [
            { name: 'chime', origin: 'user' },
            { name: 'sample', origin: 'default' },
          ],
        }),
      ),
    );
    const user = userEvent.setup();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'track', name: 'chime' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await waitFor(() => expect(screen.getByRole('radio', { name: 'chime' })).toBeChecked());
    await user.click(screen.getByRole('radio', { name: 'sample' }));
    expect(screen.getByRole('radio', { name: 'sample' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'chime' })).not.toBeChecked();
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

  it('fetch が未解決の間は、存在する予定のトラックも「見つかりません」と表示しない', async () => {
    let resolveResponse: (value: unknown) => void;
    const responsePromise = new Promise((resolve) => {
      resolveResponse = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(responsePromise));

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

    // fetch がまだ未解決のため、"見つかりません" テキストが無いことを確認
    expect(screen.queryByText('sample(現在DBに見つかりません)')).not.toBeInTheDocument();

    // fetch を解決する (sample は実際に存在する)
    resolveResponse!(jsonResponse({ tracks: [{ name: 'sample', origin: 'default' }] }));

    // 解決後も "見つかりません" テキストが無いままで、sample が選択されている
    await waitFor(() => expect(screen.getByRole('radio', { name: 'sample' })).toBeChecked());
    expect(screen.queryByText('sample(現在DBに見つかりません)')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: テストを実行し、失敗することを確認する**

Run: `pnpm vitest run src/__tests__/components/SoundAssignDialog.test.tsx`
Expected: FAIL — `getByRole('radio', ...)` や `getByRole('radiogroup', ...)` が見つからない(現状の実装は `<select>` のため)、グループ見出しのテキストも存在しない

- [ ] **Step 3: `SoundAssignDialog.module.css` を更新する**

`src/components/SoundAssignDialog.module.css` の `.section select { ... }` ブロック(35〜44行目)を削除し、代わりに以下を追加する(ファイル全体は以下の内容になる)。

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

.trackList {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--bg);
}

.trackGroupLabel {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
  padding: 8px 10px 4px;
}

.trackRow {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  font-size: 13px;
  cursor: pointer;
}

.trackRow:hover {
  background: var(--accent-soft);
}

.trackRow input[type='radio'] {
  flex: none;
  accent-color: var(--accent);
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

- [ ] **Step 4: `SoundAssignDialog.tsx` を更新する**

`src/components/SoundAssignDialog.tsx` の全体を以下の内容に置き換える。

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { AudioType, TrackOrigin } from '@/lib/types';
import type { MinuteSoundState } from '@/lib/schedule-ui';
import { pad2 } from '@/lib/schedule-ui';
import { isEditableOrigin } from '@/lib/track-ui';
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
type TrackOption = { name: string; origin: TrackOrigin };

function byName(a: TrackOption, b: TrackOption): number {
  return a.name.localeCompare(b.name);
}

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
  const [tracks, setTracks] = useState<TrackOption[] | null>(null);
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
          setTracks(
            (json.tracks as { name: string; origin: TrackOrigin }[]).map((t) => ({
              name: t.name,
              origin: t.origin,
            })),
          );
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
  const hasUnknownCurrentTrack =
    tracks !== null && trackName !== '' && !trackOptions.some((t) => t.name === trackName);
  const userTrackOptions = trackOptions.filter((t) => isEditableOrigin(t.origin)).sort(byName);
  const otherTrackOptions = trackOptions.filter((t) => !isEditableOrigin(t.origin)).sort(byName);

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
              <div className={styles.trackList} role="radiogroup" aria-label="曲を選択">
                {hasUnknownCurrentTrack && (
                  <label className={styles.trackRow}>
                    <input type="radio" name="track" checked onChange={() => setTrackName(trackName)} />
                    <span>{trackName}(現在DBに見つかりません)</span>
                  </label>
                )}
                {userTrackOptions.length > 0 && (
                  <>
                    <div className={styles.trackGroupLabel}>アップロード済み</div>
                    {userTrackOptions.map((t) => (
                      <label key={t.name} className={styles.trackRow}>
                        <input
                          type="radio"
                          name="track"
                          checked={trackName === t.name}
                          onChange={() => setTrackName(t.name)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </>
                )}
                {otherTrackOptions.length > 0 && (
                  <>
                    <div className={styles.trackGroupLabel}>初期音源・その他</div>
                    {otherTrackOptions.map((t) => (
                      <label key={t.name} className={styles.trackRow}>
                        <input
                          type="radio"
                          name="track"
                          checked={trackName === t.name}
                          onChange={() => setTrackName(t.name)}
                        />
                        <span>{t.name}</span>
                      </label>
                    ))}
                  </>
                )}
              </div>
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

- [ ] **Step 5: テストを再実行し、成功することを確認する**

Run: `pnpm vitest run src/__tests__/components/SoundAssignDialog.test.tsx`
Expected: PASS(全16件)

- [ ] **Step 6: リポジトリ全体のテストを実行し、既存機能に回帰が無いことを確認する**

Run: `pnpm test`
Expected: PASS(現状のリポジトリ全体で232件。`SoundAssignDialog.test.tsx`が13件→16件になる
差分を反映し、235件が全て green)

- [ ] **Step 7: 型チェックを実行する**

Run: `pnpm exec tsc --noEmit`
Expected: エラー無し(exit code 0)

- [ ] **Step 8: コミットする**

```bash
git add src/components/SoundAssignDialog.tsx src/components/SoundAssignDialog.module.css src/__tests__/components/SoundAssignDialog.test.tsx
git commit -m "feat: 曲指定UIをラジオボタン+originグループ分けに変更

design/006の<select>案から、単一選択であることが見た目からも
分かるラジオボタンリストに変更。/tracksと同じisEditableOriginで
アップロード済み/初期音源・その他にグループ分けする。"
```
