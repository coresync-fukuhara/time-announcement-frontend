'use client';

import { MINUTES, pad2 } from '@/lib/schedule-ui';
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
                        {/*
                          将来、この分に鳴らす曲(minute_settings.sound_file_name)を割り当てる
                          UI の見た目のみブレインストーミング済み(未実装)。
                          実データ(db/music.sqlite3 の曲一覧)を扱う API が無いため、配線はしない。

                          {on && (
                            <button
                              type="button"
                              className={
                                songAssignments[hour]?.[m]
                                  ? `${styles.songBadge} ${styles.songBadgeAssigned}`
                                  : styles.songBadge
                              }
                              aria-label={
                                songAssignments[hour]?.[m]
                                  ? `${songAssignments[hour][m]}(クリックで変更)`
                                  : '曲を割り当てる'
                              }
                              onClick={() => onRequestAssignSong(hour, m)}
                            >
                              ♪
                            </button>
                          )}
                        */}
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
