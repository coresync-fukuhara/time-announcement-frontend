'use client';

import { useEffect, useState } from 'react';
import type { Weekday } from '@/lib/types';
import dialogStyles from './dialog.module.css';
import styles from './CopyDialog.module.css';

export interface CopyDialogTarget {
  key: Weekday;
  label: string;
  count: number;
}

export interface CopyDialogProps {
  open: boolean;
  sourceDayLabel: string;
  targets: CopyDialogTarget[];
  onRequestCopy: (targetKeys: Weekday[]) => void;
  onClose: () => void;
}

// 「他の曜日へコピー」の対象曜日選択ダイアログ(No.13 関連: コピー先の現在の設定状況を表示)。
// 実際の上書き確認(差分表示)は親コンポーネントが ConfirmDialog を重ねて行う。
export function CopyDialog({
  open,
  sourceDayLabel,
  targets,
  onRequestCopy,
  onClose,
}: CopyDialogProps) {
  const [selected, setSelected] = useState<Weekday[]>([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  if (!open) return null;

  function toggle(key: Weekday) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  return (
    <div className={dialogStyles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={dialogStyles.dialog} role="dialog" aria-label="設定をコピー">
        <h2>{sourceDayLabel}曜日の設定をコピー</h2>
        <p>コピー先の曜日を選択してください(複数選択できます)</p>
        <div className={styles.chips}>
          {targets.map((target) => (
            <button
              key={target.key}
              type="button"
              className={styles.chip}
              aria-pressed={selected.includes(target.key)}
              onClick={() => toggle(target.key)}
            >
              <span className={styles.chipLabel}>{target.label}</span>
              <span className={styles.chipStatus}>
                {target.count === 0 ? '未設定' : `${target.count}件`}
              </span>
            </button>
          ))}
        </div>
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
            disabled={selected.length === 0}
            onClick={() => onRequestCopy(selected)}
          >
            コピーする
          </button>
        </div>
      </div>
    </div>
  );
}
