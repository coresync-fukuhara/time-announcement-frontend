import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SoundAssignDialog } from '@/components/SoundAssignDialog';

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

const noop = () => {};

describe('SoundAssignDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('open=false のときは何も表示しない', () => {
    render(
      <SoundAssignDialog
        open={false}
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('開くと現在の状態(none)でモード「未設定」が選ばれた状態になり、楽曲一覧を取得する', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }] }));
    vi.stubGlobal('fetch', fetchMock);
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('dialog', { name: '音の割り当て' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未設定' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/tracks'));
  });

  it('current が track のとき、開いた時点で「曲を指定」モードかつ選択済みになる', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }, { name: 'chime' }] })),
    );
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'track', name: 'sample' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: '曲を指定' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(screen.getByLabelText('曲を選択')).toHaveValue('sample'));
  });

  it('現在の曲が取得した一覧に無くても選択肢として保持する', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'chime' }] })));
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'track', name: 'deleted_track' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('曲を選択')).toHaveValue('deleted_track'));
    expect(screen.getByText('deleted_track(現在DBに見つかりません)')).toBeInTheDocument();
  });

  it('current が types のとき、開いた時点で「タイプで指定」モードかつ選択済みになる', () => {
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={30}
        current={{ mode: 'types', types: ['DEFAULT', 'ALARM'] }}
        onApply={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByRole('button', { name: 'タイプで指定' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'DEFAULT' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'NOTIFICATION' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'ALARM' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('「曲を指定」で未選択のうちは適用ボタンが非活性', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }] })));
    const user = userEvent.setup();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('曲を選んで適用すると onApply({ mode: "track", name }) を呼ぶ', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ tracks: [{ name: 'sample' }, { name: 'chime' }] })),
    );
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    await screen.findByLabelText('曲を選択');
    await user.selectOptions(screen.getByLabelText('曲を選択'), 'chime');
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'track', name: 'chime' });
  });

  it('タイプを0件選択の状態では適用ボタンが非活性', async () => {
    const user = userEvent.setup();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={noop}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeDisabled();
  });

  it('タイプを選んで適用すると、選択順によらずDEFAULT/NOTIFICATION/ALARM順で onApply を呼ぶ', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: 'DEFAULT' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'types', types: ['DEFAULT', 'ALARM'] });
  });

  it('「未設定」を選んで適用すると onApply({ mode: "none" }) を呼ぶ(常に活性)', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'types', types: ['ALARM'] }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '未設定' }));
    expect(screen.getByRole('button', { name: '適用' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'none' });
  });

  it('楽曲一覧の取得に失敗しても「タイプで指定」は使える', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={noop}
      />,
    );
    await user.click(screen.getByRole('button', { name: '曲を指定' }));
    await screen.findByText('曲一覧の取得に失敗しました。');
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(onApply).toHaveBeenCalledWith({ mode: 'types', types: ['ALARM'] });
  });

  it('キャンセルを押すと onClose を呼び、onApply は呼ばない', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(
      <SoundAssignDialog
        open
        hour={9}
        minute={0}
        current={{ mode: 'none' }}
        onApply={onApply}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
