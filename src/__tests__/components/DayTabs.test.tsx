import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DayTabs } from '@/components/DayTabs';

describe('DayTabs', () => {
  it('月〜日 + holiday の8タブを表示する', () => {
    render(<DayTabs current="monday" onSelect={() => {}} />);
    ['月', '火', '水', '木', '金', '土', '日', '祝'].forEach((label) => {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    });
  });

  it('現在の曜日タブが選択状態になっている', () => {
    render(<DayTabs current="tuesday" onSelect={() => {}} />);
    expect(screen.getByRole('tab', { name: '火' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '月' })).toHaveAttribute('aria-selected', 'false');
  });

  it('holiday タブも他の曜日と同じ role="tab" として操作できる(No.1 確定事項)', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DayTabs current="monday" onSelect={onSelect} />);
    await user.click(screen.getByRole('tab', { name: '祝' }));
    expect(onSelect).toHaveBeenCalledWith('holiday');
  });

  it('タブをクリックすると onSelect が呼ばれる', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<DayTabs current="monday" onSelect={onSelect} />);
    await user.click(screen.getByRole('tab', { name: '土' }));
    expect(onSelect).toHaveBeenCalledWith('saturday');
  });
});
