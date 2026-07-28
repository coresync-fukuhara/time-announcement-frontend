'use client';

import dialogStyles from './dialog.module.css';

export interface ErrorDialogProps {
  open: boolean;
  message: string;
  detail?: string;
  onClose: () => void;
}

// 保存(PUT /api/schedules)失敗時のエラー表示。
// エラー内容(Ajv の details など)をそのまま中央ダイアログで見せる(ブレインストーミングでの決定)。
export function ErrorDialog({ open, message, detail, onClose }: ErrorDialogProps) {
  if (!open) return null;

  return (
    <div
      className={dialogStyles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={dialogStyles.dialog} role="alertdialog" aria-label="保存エラー">
        <h2 style={{ color: 'var(--danger)' }}>{message}</h2>
        <p>入力内容の検証でエラーが発生しました。内容を確認してください。</p>
        {detail && <div className={dialogStyles.detail}>{detail}</div>}
        <div className={dialogStyles.dialogActions} style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className={`${dialogStyles.btn} ${dialogStyles.btnPrimary}`}
            onClick={onClose}
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
