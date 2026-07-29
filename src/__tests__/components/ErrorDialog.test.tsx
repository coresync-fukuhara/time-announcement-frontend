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

  it('description を渡すと差し替わる(楽曲管理画面での再利用を想定)', () => {
    render(
      <ErrorDialog
        open
        message="アップロードに失敗しました"
        description="同じ表示名の楽曲が既に存在します。"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('アップロードに失敗しました')).toBeInTheDocument();
    expect(screen.getByText('同じ表示名の楽曲が既に存在します。')).toBeInTheDocument();
    expect(
      screen.queryByText('入力内容の検証でエラーが発生しました。内容を確認してください。'),
    ).not.toBeInTheDocument();
  });

  it('description を省略すると既定の文言(スケジュール画面向け)が表示される', () => {
    render(<ErrorDialog open message="保存に失敗しました" onClose={() => {}} />);
    expect(
      screen.getByText('入力内容の検証でエラーが発生しました。内容を確認してください。'),
    ).toBeInTheDocument();
  });
});
