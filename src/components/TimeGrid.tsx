'use client';

import { getMinuteSound, MINUTES, pad2 } from '@/lib/schedule-ui';
import type { HourMap } from '@/lib/schedule-ui';
import styles from './TimeGrid.module.css';

export interface TimeGridProps {
  dayLabel: string;
  hours: HourMap;
  viewMode: boolean;
  onToggleMinute: (hour: number, minute: number) => void;
  onRequestDeleteHour: (hour: number) => void;
  onRequestAddHour: () => void;
  onRequestCopy: () => void;
  onRequestAssignSound: (hour: number, minute: number) => void;
}

// 曜日タブで選ばれた1日分の時刻グリッド(006)。
// 閲覧(確認)モードでは全ての操作を非活性にし、行の追加/削除・曜日コピーの入口も隠す(No.13 確定)。
export function TimeGrid({
  dayLabel,
  hours,
  viewMode,
  onToggleMinute,
  onRequestDeleteHour,
  onRequestAddHour,
  onRequestCopy,
  onRequestAssignSound,
}: TimeGridProps) {
  const sortedHours = Object.keys(hours)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h2>{dayLabel}曜日</h2>
        <p>
          {viewMode
            ? '現在設定されている鳴動時刻です(確認のみ)'
            : '行内のボタンをクリックして鳴動する分をON/OFFします(5分刻み)'}
        </p>
      </div>

      <div className={styles.gridScroll}>
        <div className={styles.grid} role="table">
          <div />
          {MINUTES.map((m) => (
            <div key={m} className={styles.gridHeaderCell}>
              {pad2(m)}
            </div>
          ))}
          <div />

          {sortedHours.length === 0 ? (
            <div className={styles.emptyRow} style={{ gridColumn: '1 / -1' }}>
              {viewMode
                ? 'この曜日には鳴動設定がありません。'
                : 'この曜日にはまだ時間が設定されていません。「+ 時間を追加」から始めてください。'}
            </div>
          ) : (
            sortedHours.map((hour) => {
              const activeMinutes = hours[hour].minutes ?? [];
              return (
                <div key={hour} className={styles.row}>
                  <div className={styles.hourLabel}>{hour}時</div>
                  {MINUTES.map((m) => {
                    const on = activeMinutes.includes(m);
                    const sound = getMinuteSound(hours[hour], m);
                    const badgeClass =
                      sound.mode === 'track'
                        ? `${styles.songBadge} ${styles.songBadgeAssigned}`
                        : sound.mode === 'types'
                          ? `${styles.songBadge} ${styles.songBadgeTypes}`
                          : styles.songBadge;
                    const badgeLabel =
                      sound.mode === 'track'
                        ? `${hour}時${pad2(m)}分: 曲「${sound.name}」(クリックで変更)`
                        : sound.mode === 'types'
                          ? `${hour}時${pad2(m)}分: タイプ ${sound.types.join('・')}(クリックで変更)`
                          : `${hour}時${pad2(m)}分の音を割り当てる`;
                    return (
                      <div key={m} className={styles.lampCell}>
                        <button
                          type="button"
                          className={styles.lamp}
                          aria-pressed={on}
                          aria-label={`${hour}時${pad2(m)}分`}
                          disabled={viewMode}
                          onClick={() => onToggleMinute(hour, m)}
                        />
                        {on && (
                          <button
                            type="button"
                            className={badgeClass}
                            aria-label={badgeLabel}
                            disabled={viewMode}
                            onClick={() => onRequestAssignSound(hour, m)}
                          >
                            ♪
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!viewMode && (
                    <div className={styles.rowDelete}>
                      <button
                        type="button"
                        aria-label={`${hour}時の行を削除`}
                        onClick={() => onRequestDeleteHour(hour)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {!viewMode && (
        <div className={styles.panelFoot}>
          <button type="button" className={styles.copyToggle} onClick={onRequestCopy}>
            他の曜日へコピー
          </button>
          <div className={styles.footSpacer} />
          <button type="button" className={styles.addHourBtn} onClick={onRequestAddHour}>
            + 時間を追加
          </button>
        </div>
      )}
    </div>
  );
}
