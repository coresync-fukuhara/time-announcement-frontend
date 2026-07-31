import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimeGrid } from '@/components/TimeGrid';
import type { HourMap } from '@/lib/schedule-ui';

function makeHours(): HourMap {
  return {
    9: { hour: 9, minutes: [0, 30] },
    17: { hour: 17, minutes: [0] },
  };
}

function makeHoursWithSound(): HourMap {
  return {
    9: {
      hour: 9,
      minutes: [0, 30],
      minute_settings: {
        '0': { sound_file_name: 'sample' },
        '30': { sound_file_name: '', sound_types: ['ALARM'] },
      },
    },
  };
}

const noop = () => {};

describe('TimeGrid', () => {
  it('時間行と5分刻みボタンを表示する(No.10 確定)', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByText('9時')).toBeInTheDocument();
    expect(screen.getByText('17時')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9時00分' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '9時05分' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('ボタンをクリックすると onToggleMinute(hour, minute) を呼ぶ', async () => {
    const user = userEvent.setup();
    const onToggleMinute = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={onToggleMinute}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '9時05分' }));
    expect(onToggleMinute).toHaveBeenCalledWith(9, 5);
  });

  it('閲覧モードではトグルボタンが非活性になる', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分' })).toBeDisabled();
  });

  it('行の削除ボタンで onRequestDeleteHour(hour) を呼ぶ', async () => {
    const user = userEvent.setup();
    const onRequestDeleteHour = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={onRequestDeleteHour}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '9時の行を削除' }));
    expect(onRequestDeleteHour).toHaveBeenCalledWith(9);
  });

  it('閲覧モードでは時間の追加・削除・コピーのコントロールを表示しない', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.queryByRole('button', { name: /時間を追加/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /コピー/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '9時の行を削除' })).not.toBeInTheDocument();
  });

  it('編集モードで「+ 時間を追加」を押すと onRequestAddHour を呼ぶ', async () => {
    const user = userEvent.setup();
    const onRequestAddHour = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={onRequestAddHour}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: /時間を追加/ }));
    expect(onRequestAddHour).toHaveBeenCalled();
  });

  it('「他の曜日へコピー」を押すと onRequestCopy を呼ぶ', async () => {
    const user = userEvent.setup();
    const onRequestCopy = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={onRequestCopy}
        onRequestAssignSound={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: /コピー/ }));
    expect(onRequestCopy).toHaveBeenCalled();
  });

  it('時間が無い日は空メッセージを表示する', () => {
    render(
      <TimeGrid
        dayLabel="土"
        hours={{}}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByText(/まだ時間が設定されていません/)).toBeInTheDocument();
  });

  it('ONの分にのみ音バッジを表示し、状態に応じてラベルが変わる(No.13関連: 詳細設計3.1節)', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHoursWithSound()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分: 曲「sample」(クリックで変更)' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '9時30分: タイプ ALARM(クリックで変更)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '9時05分の音を割り当てる' })).not.toBeInTheDocument();
  });

  it('未設定のONの分は「音を割り当てる」ラベルのバッジを表示する', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分の音を割り当てる' })).toBeInTheDocument();
  });

  it('バッジをクリックすると onRequestAssignSound(hour, minute) を呼ぶ', async () => {
    const user = userEvent.setup();
    const onRequestAssignSound = vi.fn();
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode={false}
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={onRequestAssignSound}
      />,
    );
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    expect(onRequestAssignSound).toHaveBeenCalledWith(9, 0);
  });

  it('閲覧モードではバッジが非活性になる', () => {
    render(
      <TimeGrid
        dayLabel="月"
        hours={makeHours()}
        viewMode
        onToggleMinute={noop}
        onRequestDeleteHour={noop}
        onRequestAddHour={noop}
        onRequestCopy={noop}
        onRequestAssignSound={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '9時00分の音を割り当てる' })).toBeDisabled();
  });
});
