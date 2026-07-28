'use client';

import styles from './dialog.module.css';

export type InitChoice = 'empty' | 'sample';

export interface InitDialogProps {
  onChoose: (choice: InitChoice) => void;
}

// schedules.json が無い/壊れている場合に表示する初期化ダイアログ(005・No.9)。
// 有効なデータが存在しない状態のため、選択肢を選ぶ以外に閉じる手段は設けない(No.13 関連の決定)。
export function InitDialog({ onChoose }: InitDialogProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.dialog} role="dialog" aria-label="初期化">
        <h2>schedules.json が見つかりません</h2>
        <p>どのように始めますか?</p>
        <button type="button" className={styles.choice} onClick={() => onChoose('empty')}>
          <strong>空の週間スケジュールで始める</strong>
          <span>すべての曜日を未設定の状態から作ります</span>
        </button>
        <button type="button" className={styles.choice} onClick={() => onChoose('sample')}>
          <strong>サンプル設定からコピーして始める</strong>
          <span>よくある構成から始めます</span>
        </button>
      </div>
    </div>
  );
}
