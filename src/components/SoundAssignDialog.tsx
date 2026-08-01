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
