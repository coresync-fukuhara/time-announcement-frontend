import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorDialog } from '@/components/ErrorDialog';

describe('ErrorDialog', () => {
  it('open=false のときは何も表示しない', () => {
    render(<ErrorDialog open={false} message="保存に失敗しました" onClose={() => {}} />);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('メッセージと詳細(バリデーションエラー内容など)を表示する', () => {
    render(
      <ErrorDialog
        open
        message="保存に失敗しました"
        detail='[{"instancePath":"/monday/0/hour","message":"must be <= 23"}]'
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('保存に失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/must be <= 23/)).toBeInTheDocument();
  });

  it('閉じるボタンで onClose を呼ぶ', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ErrorDialog open message="保存に失敗しました" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '閉じる' }));
    expect(onClose).toHaveBeenCalled();
  });
});
