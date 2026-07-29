import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackSection } from '@/components/TrackSection';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [{ id: 1, name: 'DEFAULT' }];

const tracks: Track[] = [
  { id: 1, name: 'chime_intro', filePath: '/x', origin: 'user', audioTypes: [] },
  { id: 2, name: 'school_bell', filePath: '/y', origin: 'user', audioTypes: [] },
];

describe('TrackSection', () => {
  it('見出しと各行を表示する', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('heading', { name: 'アップロード済み' })).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
    expect(screen.getByText('school_bell')).toBeInTheDocument();
  });

  it('楽曲が0件のときは emptyMessage を表示する', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={[]}
        audioTypes={audioTypes}
        emptyMessage="アップロード済みの楽曲はまだありません。"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('アップロード済みの楽曲はまだありません。')).toBeInTheDocument();
  });

  it('busyTrackId に一致する行だけ busy になる(削除ボタンが非活性)', () => {
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={2}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'school_bell を削除' })).toBeDisabled();
  });

  it('行の削除ボタンをクリックすると、その行の id で onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <TrackSection
        title="アップロード済み"
        tracks={tracks}
        audioTypes={audioTypes}
        emptyMessage="ありません"
        busyTrackId={null}
        onRename={() => {}}
        onToggleAudioType={() => {}}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'school_bell を削除' }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });
});
