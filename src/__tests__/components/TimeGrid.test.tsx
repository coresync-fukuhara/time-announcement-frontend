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
      />,
    );
    expect(screen.getByText(/まだ時間が設定されていません/)).toBeInTheDocument();
  });
});
