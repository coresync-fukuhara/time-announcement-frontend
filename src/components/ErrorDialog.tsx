'use client';

import dialogStyles from './dialog.module.css';

export interface ErrorDialogProps {
  open: boolean;
  message: string;
  description?: string;
  detail?: string;
  onClose: () => void;
}

// 保存(PUT /api/schedules)失敗時のエラー表示として導入(ブレインストーミングでの決定)。
// 楽曲管理画面(/tracks)でも同じコンポーネントを再利用するため、本文(description)を
// 呼び出し側で差し替え可能にした(画面詳細設計 7章)。省略時は元のスケジュール画面向けの
// 文言をそのまま使う(後方互換)。
export function ErrorDialog({
  open,
  message,
  description = '入力内容の検証でエラーが発生しました。内容を確認してください。',
  detail,
  onClose,
}: ErrorDialogProps) {
  if (!open) return null;

  return (
    <div
      className={dialogStyles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={dialogStyles.dialog} role="alertdialog" aria-label="エラー">
        <h2 style={{ color: 'var(--danger)' }}>{message}</h2>
        <p>{description}</p>
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
