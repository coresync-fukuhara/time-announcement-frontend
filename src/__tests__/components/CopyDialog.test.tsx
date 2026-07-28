import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopyDialog } from '@/components/CopyDialog';

const targets = [
  { key: 'tuesday' as const, label: '火', count: 0 },
  { key: 'saturday' as const, label: '土', count: 3 },
];

describe('CopyDialog', () => {
  it('open=false のときは何も表示しない', () => {
    render(
      <CopyDialog
        open={false}
        sourceDayLabel="月"
        targets={targets}
        onRequestCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('コピー元の曜日名と、コピー先ごとの設定状況を表示する', () => {
    render(
      <CopyDialog
        open
        sourceDayLabel="月"
        targets={targets}
        onRequestCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/月曜日/)).toBeInTheDocument();
    expect(screen.getByText('未設定')).toBeInTheDocument();
    expect(screen.getByText('3件')).toBeInTheDocument();
  });

  it('コピー先を選ばないうちは「コピーする」が非活性', () => {
    render(
      <CopyDialog
        open
        sourceDayLabel="月"
        targets={targets}
        onRequestCopy={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'コピーする' })).toBeDisabled();
  });

  it('コピー先を選択して確定すると onRequestCopy に選んだ曜日キーを渡す', async () => {
    const user = userEvent.setup();
    const onRequestCopy = vi.fn();
    render(
      <CopyDialog
        open
        sourceDayLabel="月"
        targets={targets}
        onRequestCopy={onRequestCopy}
        onClose={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /土/ }));
    await user.click(screen.getByRole('button', { name: 'コピーする' }));
    expect(onRequestCopy).toHaveBeenCalledWith(['saturday']);
  });

  it('キャンセルで onClose を呼ぶ', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <CopyDialog
        open
        sourceDayLabel="月"
        targets={targets}
        onRequestCopy={() => {}}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
  });
});
