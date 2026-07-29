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
