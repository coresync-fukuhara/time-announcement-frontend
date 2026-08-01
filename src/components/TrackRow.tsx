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
