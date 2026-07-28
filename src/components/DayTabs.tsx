'use client';

import { DAY_TABS } from '@/lib/schedule-ui';
import type { Weekday } from '@/lib/types';
import styles from './DayTabs.module.css';

export interface DayTabsProps {
  current: Weekday;
  onSelect: (day: Weekday) => void;
}

// 曜日タブ(月〜日 + holiday)。holiday も他の曜日と同じ role="tab" で操作できる(No.1 確定)。
export function DayTabs({ current, onSelect }: DayTabsProps) {
  return (
    <div className={styles.tabs} role="tablist" aria-label="曜日">
      {DAY_TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          role="tab"
          aria-selected={key === current}
          className={key === 'holiday' ? `${styles.tab} ${styles.holidayTab}` : styles.tab}
          onClick={() => onSelect(key)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
