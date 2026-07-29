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
