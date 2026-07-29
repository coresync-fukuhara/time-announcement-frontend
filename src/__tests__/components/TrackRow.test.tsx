import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackRow } from '@/components/TrackRow';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [
  { id: 1, name: 'DEFAULT' },
  { id: 2, name: 'NOTIFICATION' },
  { id: 3, name: 'ALARM' },
];

const userTrack: Track = {
  id: 10,
  name: 'chime_intro',
  filePath: '/data/sounds/user/chime_intro.wav',
  origin: 'user',
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

const defaultTrack: Track = {
  id: 20,
  name: 'default_chime',
  filePath: '/data/sounds/default/default_chime.wav',
  origin: 'default',
  audioTypes: [],
};

describe('TrackRow', () => {
  it('origin=user の行は名前ボタン・削除ボタンを表示する', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeInTheDocument();
  });

  it('origin=default の行は名前がラベル表示になり、削除ボタンの代わりに🔒を表示する', () => {
    render(
      <TrackRow
        track={defaultTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.queryByRole('button', { name: /クリックして名前を変更/ })).not.toBeInTheDocument();
    expect(screen.getByText('default_chime')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /を削除/ })).not.toBeInTheDocument();
    expect(screen.getByLabelText('編集不可')).toBeInTheDocument();
  });

  it('割り当て済みの音声タイプは aria-pressed=true になる', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro DEFAULT' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('バッジをクリックすると onToggleAudioType にそのタイプの id を渡す', async () => {
    const user = userEvent.setup();
    const onToggleAudioType = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={onToggleAudioType}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(2);
  });

  it('default 行でもバッジのクリックで onToggleAudioType が呼ばれる(タイプ変更のみ許可)', async () => {
    const user = userEvent.setup();
    const onToggleAudioType = vi.fn();
    render(
      <TrackRow
        track={defaultTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={onToggleAudioType}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'default_chime DEFAULT' }));
    expect(onToggleAudioType).toHaveBeenCalledWith(1);
  });

  it('名前ボタンをクリックすると入力欄に切り替わり、値を変えてEnterするとonRenameが呼ばれる', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={onRename}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'new_name{Enter}');
    expect(onRename).toHaveBeenCalledWith('new_name');
  });

  it('名前を変えずに確定した場合は onRename を呼ばない', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={onRename}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();
  });

  it('busy=true のときは名前ボタン・バッジ・削除ボタンが非活性', () => {
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro DEFAULT' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeDisabled();
  });

  it('削除ボタンをクリックすると onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TrackRow
        track={userTrack}
        audioTypes={audioTypes}
        busy={false}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    expect(onDelete).toHaveBeenCalled();
  });
});
