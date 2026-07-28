import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InitDialog } from '@/components/InitDialog';

describe('InitDialog', () => {
  it('見出しと2つの選択肢を表示する', () => {
    render(<InitDialog onChoose={() => {}} />);
    expect(screen.getByText('schedules.json が見つかりません')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /空の週間スケジュールで始める/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /サンプル設定からコピーして始める/ }),
    ).toBeInTheDocument();
  });

  it('「空の週間スケジュールで始める」を選ぶと onChoose("empty") を呼ぶ', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<InitDialog onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /空の週間スケジュールで始める/ }));
    expect(onChoose).toHaveBeenCalledWith('empty');
  });

  it('「サンプル設定からコピーして始める」を選ぶと onChoose("sample") を呼ぶ', async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    render(<InitDialog onChoose={onChoose} />);
    await user.click(screen.getByRole('button', { name: /サンプル設定からコピーして始める/ }));
    expect(onChoose).toHaveBeenCalledWith('sample');
  });

  it('キャンセルの手段(ボタン)を持たない(選択肢を選ぶまで閉じられない)', () => {
    render(<InitDialog onChoose={() => {}} />);
    expect(screen.queryByRole('button', { name: 'キャンセル' })).not.toBeInTheDocument();
  });
});
