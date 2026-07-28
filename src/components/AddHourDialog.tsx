'use client';

import { useEffect, useState } from 'react';
import dialogStyles from './dialog.module.css';
import styles from './AddHourDialog.module.css';

export interface AddHourDialogProps {
  open: boolean;
  usedHours: number[];
  onAdd: (hours: number[]) => void;
  onClose: () => void;
}

const ALL_HOURS = Array.from({ length: 24 }, (_, h) => h);

// 「+ 時間を追加」ダイアログ。複数の時間を選択してからまとめて追加する
// (ネイティブ select + 別ボタンの2段階操作より、ワンクリックで選べるチップ形式の方が使いやすいという
// ブレインストーミングの結果を反映)。
export function AddHourDialog({ open, usedHours, onAdd, onClose }: AddHourDialogProps) {
  const [selected, setSelected] = useState<number[]>([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  if (!open) return null;

  function toggle(hour: number) {
    setSelected((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour],
    );
  }

  function handleAdd() {
    if (selected.length === 0) return;
    onAdd(selected);
  }

  return (
    <div className={dialogStyles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={dialogStyles.dialog} role="dialog" aria-label="時間を追加">
        <h2>時間を追加</h2>
        <p>追加する時間を選択してください(複数選択できます)</p>
        <div className={styles.hourGrid}>
          {ALL_HOURS.map((hour) => {
            const used = usedHours.includes(hour);
            return (
              <button
                key={hour}
                type="button"
                className={styles.hourChip}
                disabled={used}
                aria-pressed={selected.includes(hour)}
                onClick={() => toggle(hour)}
              >
                {hour}時
              </button>
            );
          })}
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
            onClick={handleAdd}
          >
            追加する
          </button>
        </div>
      </div>
    </div>
  );
}
