import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '@/components/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('open=false のときは何も表示しない', () => {
    render(
      <ConfirmDialog
        open={false}
        title="削除"
        message="本当に削除しますか?"
        actionLabel="削除する"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('タイトル・メッセージ・実行ボタンのラベルを表示する', () => {
    render(
      <ConfirmDialog
        open
        title="削除"
        message="本当に削除しますか?"
        actionLabel="削除する"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText('削除')).toBeInTheDocument();
    expect(screen.getByText('本当に削除しますか?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '削除する' })).toBeInTheDocument();
  });

  it('実行ボタンで onConfirm を呼ぶ', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="削除"
        message="本当に削除しますか?"
        actionLabel="削除する"
        onConfirm={onConfirm}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: '削除する' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('キャンセルで onCancel を呼ぶ', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="削除"
        message="本当に削除しますか?"
        actionLabel="削除する"
        onConfirm={() => {}}
        onCancel={onCancel}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('detail を渡すと表示する(コピー時の差分表示などに使う)', () => {
    render(
      <ConfirmDialog
        open
        title="コピー"
        message="上書きします"
        actionLabel="コピーする"
        onConfirm={() => {}}
        onCancel={() => {}}
        detail={<div>9時 00,30 → 00,30</div>}
      />,
    );
    expect(screen.getByText('9時 00,30 → 00,30')).toBeInTheDocument();
  });
});
