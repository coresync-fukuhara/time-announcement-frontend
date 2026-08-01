'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { DayTabs } from '@/components/DayTabs';
import { TimeGrid } from '@/components/TimeGrid';
import { InitDialog, type InitChoice } from '@/components/InitDialog';
import { AddHourDialog } from '@/components/AddHourDialog';
import { CopyDialog } from '@/components/CopyDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ErrorDialog } from '@/components/ErrorDialog';
import { CopyDiff } from '@/components/CopyDiff';
import { NavSwitcher } from '@/components/NavSwitcher';
import { SoundAssignDialog } from '@/components/SoundAssignDialog';
import {
  DAY_TABS,
  dayLabel,
  toEditableSchedules,
  fromEditableSchedules,
  emptyEditableSchedules,
  toggleMinute,
  copyDay,
  diffHourMinutes,
  getMinuteSound,
  setMinuteSoundTrack,
  setMinuteSoundTypes,
  clearMinuteSound,
  type EditableSchedules,
  type HourMap,
  type MinuteSoundState,
} from '@/lib/schedule-ui';
import type { Weekday, Schedules } from '@/lib/types';
import styles from './page.module.css';
import shellStyles from '@/components/screen-shell.module.css';

type Phase = 'loading' | 'needs-init' | 'ready' | 'load-error';

interface ConfirmState {
  title: string;
  message: string;
  actionLabel: string;
  detail?: ReactNode;
  onConfirm: () => void;
}

interface ErrorState {
  message: string;
  detail?: string;
}

// スケジュール設定画面(005 初期化ダイアログ・006 曜日タブ/時刻グリッドの配線)。
// 既定で閲覧(確認)モードとして開き、右上ボタン(「編集」⇔「保存」)で編集モードと行き来する(No.13)。
export default function Home() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [schedules, setSchedules] = useState<EditableSchedules | null>(null);
  const [currentDay, setCurrentDay] = useState<Weekday>('monday');
  const [viewMode, setViewMode] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [addHourOpen, setAddHourOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [soundAssignTarget, setSoundAssignTarget] = useState<{ hour: number; minute: number } | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/schedules');
        if (!res.ok) throw new Error('load failed');
        const json = await res.json();
        if (cancelled) return;
        if (json.initialized) {
          setSchedules(toEditableSchedules(json.schedules as Schedules));
          setViewMode(true);
          setPhase('ready');
        } else {
          setPhase('needs-init');
        }
      } catch {
        if (!cancelled) setPhase('load-error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleInitChoice(choice: InitChoice) {
    let next = emptyEditableSchedules();
    if (choice === 'sample') {
      try {
        const res = await fetch('/api/sample-schedules');
        const json = await res.json();
        if (json.found) next = toEditableSchedules(json.schedules as Schedules);
      } catch {
        // サンプルが取得できない場合は空のスケジュールにフォールバックする。
      }
    }
    setSchedules(next);
    setCurrentDay('monday');
    setViewMode(false);
    setPhase('ready');
  }

  if (phase === 'loading') {
    return (
      <div className={shellStyles.shell}>
        <header className={shellStyles.topbar}>
          <h1>時報 設定</h1>
          <NavSwitcher current="schedule" />
        </header>
        <main className={shellStyles.main}>
          <div className={shellStyles.loadingPanel}>読み込み中...</div>
        </main>
      </div>
    );
  }

  if (phase === 'load-error') {
    return (
      <div className={shellStyles.shell}>
        <header className={shellStyles.topbar}>
          <h1>時報 設定</h1>
          <NavSwitcher current="schedule" />
        </header>
        <main className={shellStyles.main}>
          <div className={shellStyles.loadingPanel}>
            読み込みに失敗しました。ページを再読み込みしてください。
          </div>
        </main>
      </div>
    );
  }

  if (phase === 'needs-init') {
    return <InitDialog onChoose={handleInitChoice} />;
  }

  const data = schedules as EditableSchedules;
  const hours = data[currentDay];

  function updateDay(day: Weekday, hourMap: HourMap) {
    setSchedules((prev) => (prev ? { ...prev, [day]: hourMap } : prev));
  }

  function handleToggleMinute(hour: number, minute: number) {
    const entry = hours[hour];
    if (!entry) return;
    updateDay(currentDay, { ...hours, [hour]: toggleMinute(entry, minute) });
    setDirty(true);
  }

  function handleRequestDeleteHour(hour: number) {
    setConfirmState({
      title: `${hour}時の設定を削除`,
      message: 'この時間帯の鳴動設定をすべて削除します。よろしいですか?',
      actionLabel: '削除する',
      onConfirm: () => {
        const next = { ...hours };
        delete next[hour];
        updateDay(currentDay, next);
        setDirty(true);
        setConfirmState(null);
      },
    });
  }

  function handleAddHours(newHours: number[]) {
    const next = { ...hours };
    newHours.forEach((h) => {
      next[h] = { hour: h, minutes: [] };
    });
    updateDay(currentDay, next);
    setDirty(true);
    setAddHourOpen(false);
  }

  function handleRequestCopy(targetKeys: Weekday[]) {
    setConfirmState({
      title: '設定のコピー',
      message: `${targetKeys.map(dayLabel).join('・')}曜日の現在の設定を上書きします。よろしいですか?`,
      actionLabel: 'コピーする',
      detail: (
        <>
          {targetKeys.map((key) => (
            <CopyDiff key={key} dayLabel={dayLabel(key)} rows={diffHourMinutes(hours, data[key])} />
          ))}
        </>
      ),
      onConfirm: () => {
        setSchedules((prev) => (prev ? copyDay(prev, currentDay, targetKeys) : prev));
        setDirty(true);
        setCopyOpen(false);
        setConfirmState(null);
      },
    });
  }

  function handleApplySound(next: MinuteSoundState) {
    if (!soundAssignTarget) return;
    const { hour, minute } = soundAssignTarget;
    const entry = hours[hour];
    if (!entry) {
      setSoundAssignTarget(null);
      return;
    }
    const updatedEntry =
      next.mode === 'none'
        ? clearMinuteSound(entry, minute)
        : next.mode === 'track'
          ? setMinuteSoundTrack(entry, minute, next.name)
          : setMinuteSoundTypes(entry, minute, next.types);
    // 実質変更が無ければ(例: 未設定の分に未設定を適用)未保存インジケーターを出さない。
    if (updatedEntry !== entry) {
      updateDay(currentDay, { ...hours, [hour]: updatedEntry });
      setDirty(true);
    }
    setSoundAssignTarget(null);
  }

  async function handleSave() {
    if (viewMode) {
      setViewMode(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/schedules', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(fromEditableSchedules(data)),
      });
      const json = await res.json();
      if (res.ok) {
        setSchedules(toEditableSchedules(json.schedules as Schedules));
        setDirty(false);
        setViewMode(true);
      } else if (json.error === 'validation_failed') {
        // 保存前バリデーションエラー時は画面遷移しない(編集モードのまま、エラー内容を表示する)。
        setErrorState({
          message: '保存に失敗しました',
          detail: JSON.stringify(json.details, null, 2),
        });
      } else {
        setErrorState({ message: '保存に失敗しました', detail: String(json.error ?? 'unknown') });
      }
    } catch {
      setErrorState({ message: '保存に失敗しました', detail: 'ネットワークエラーが発生しました' });
    } finally {
      setSaving(false);
    }
  }

  const usedHours = Object.keys(hours).map(Number);
  const copyTargets = DAY_TABS.filter((d) => d.key !== currentDay).map((d) => ({
    key: d.key,
    label: d.label,
    count: Object.keys(data[d.key]).length,
  }));
  const soundAssignEntry = soundAssignTarget ? hours[soundAssignTarget.hour] : undefined;

  return (
    <div className={shellStyles.shell}>
      <header className={shellStyles.topbar}>
        <h1>時報 設定</h1>
        <div className={styles.actions}>
          <NavSwitcher current="schedule" />
          {dirty && <span className={styles.unsavedChip}>未保存の変更があります</span>}
          <button type="button" onClick={handleSave} disabled={saving}>
            {viewMode ? '編集' : saving ? '保存中...' : '保存'}
          </button>
        </div>
      </header>
      <main className={shellStyles.main}>
        <DayTabs current={currentDay} onSelect={setCurrentDay} />
        <TimeGrid
          dayLabel={dayLabel(currentDay)}
          hours={hours}
          viewMode={viewMode}
          onToggleMinute={handleToggleMinute}
          onRequestDeleteHour={handleRequestDeleteHour}
          onRequestAddHour={() => setAddHourOpen(true)}
          onRequestCopy={() => setCopyOpen(true)}
          onRequestAssignSound={(hour, minute) => setSoundAssignTarget({ hour, minute })}
        />
      </main>

      <AddHourDialog
        open={addHourOpen}
        usedHours={usedHours}
        onAdd={handleAddHours}
        onClose={() => setAddHourOpen(false)}
      />
      <CopyDialog
        open={copyOpen}
        sourceDayLabel={dayLabel(currentDay)}
        targets={copyTargets}
        onRequestCopy={handleRequestCopy}
        onClose={() => setCopyOpen(false)}
      />
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.title ?? ''}
        message={confirmState?.message ?? ''}
        actionLabel={confirmState?.actionLabel ?? ''}
        detail={confirmState?.detail}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />
      <ErrorDialog
        open={errorState !== null}
        message={errorState?.message ?? ''}
        detail={errorState?.detail}
        onClose={() => setErrorState(null)}
      />
      <SoundAssignDialog
        open={soundAssignEntry !== undefined}
        hour={soundAssignTarget?.hour ?? 0}
        minute={soundAssignTarget?.minute ?? 0}
        current={
          soundAssignEntry && soundAssignTarget
            ? getMinuteSound(soundAssignEntry, soundAssignTarget.minute)
            : { mode: 'none' }
        }
        onApply={handleApplySound}
        onClose={() => setSoundAssignTarget(null)}
      />
    </div>
  );
}
