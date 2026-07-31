import type { MinuteDiffRow } from '@/lib/schedule-ui';
import styles from './CopyDiff.module.css';

export interface CopyDiffProps {
  dayLabel: string;
  rows: MinuteDiffRow[];
}

// 曜日コピー確認ダイアログ内で、1つのコピー先曜日について「変更前 → 変更後」を表示する。
export function CopyDiff({ dayLabel, rows }: CopyDiffProps) {
  return (
    <div>
      <div className={styles.dayTitle}>{dayLabel}曜日</div>
      {rows.length === 0 ? (
        <div className={styles.empty}>変更はありません(どちらも未設定)</div>
      ) : (
        <table className={styles.table}>
          <tbody>
            {rows.map((row) => (
              <tr key={row.hour}>
                <td className={styles.hour}>{row.hour}時</td>
                <td className={row.status === 'removed' || row.status === 'same' ? styles[row.status] : undefined}>
                  {row.beforeText}
                </td>
                <td className={styles.arrow}>→</td>
                <td
                  className={
                    row.status === 'added' || row.status === 'changed'
                      ? styles.added
                      : row.status === 'same'
                        ? styles.same
                        : undefined
                  }
                >
                  {row.afterText}
                  {row.soundChanged && <span className={styles.soundNote}>(音の割り当ても変更されます)</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
