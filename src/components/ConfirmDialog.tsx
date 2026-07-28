'use client';

import type { ReactNode } from 'react';
import dialogStyles from './dialog.module.css';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  actionLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  detail?: ReactNode;
}

// 破壊的な操作(時間行の削除・曜日コピーによる上書き)の前に挟む汎用確認ダイアログ。
// detail に差分などの補足情報を差し込める(コピー時の「変更前 → 変更後」表示に使う)。
export function ConfirmDialog({
  open,
  title,
  message,
  actionLabel,
  onConfirm,
  onCancel,
  detail,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className={dialogStyles.overlay}
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className={dialogStyles.dialog} role="alertdialog" aria-label="確認">
        <h2>{title}</h2>
        <p>{message}</p>
        {detail && <div className={dialogStyles.detail}>{detail}</div>}
        <div className={dialogStyles.dialogActions}>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnGhost}`}
            onClick={onCancel}
          >
            キャンセル
          </button>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnDanger}`}
            onClick={onConfirm}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
