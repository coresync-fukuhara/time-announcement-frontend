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
