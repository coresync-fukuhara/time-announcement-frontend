import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackSection, type TrackSectionProps } from '@/components/TrackSection';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [{ id: 1, name: 'DEFAULT' }];

const tracks: Track[] = [
  { id: 1, name: 'chime_intro', filePath: '/x', origin: 'user', audioTypes: [] },
  { id: 2, name: 'school_bell', filePath: '/y', origin: 'user', audioTypes: [] },
];

function renderSection(overrides: Partial<TrackSectionProps> = {}) {
  const props: TrackSectionProps = {
    title: 'アップロード済み',
    tracks,
    audioTypes,
    emptyMessage: 'ありません',
    busyTrackIds: new Set(),
    playingTrackId: null,
    onRename: () => {},
    onToggleAudioType: () => {},
    onDelete: () => {},
    onTogglePlay: () => {},
    ...overrides,
  };
  return render(<TrackSection {...props} />);
}

describe('TrackSection', () => {
  it('見出しと各行を表示する', () => {
    renderSection();
    expect(screen.getByRole('heading', { name: 'アップロード済み' })).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
    expect(screen.getByText('school_bell')).toBeInTheDocument();
  });

  it('楽曲が0件のときは emptyMessage を表示する', () => {
    renderSection({ tracks: [], emptyMessage: 'アップロード済みの楽曲はまだありません。' });
    expect(screen.getByText('アップロード済みの楽曲はまだありません。')).toBeInTheDocument();
  });

  it('busyTrackIds に含まれる行だけ busy になる(削除ボタンが非活性)', () => {
    renderSection({ busyTrackIds: new Set([2]) });
    expect(screen.getByRole('button', { name: 'chime_intro を削除' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'school_bell を削除' })).toBeDisabled();
  });

  it('行の削除ボタンをクリックすると、その行の id で onDelete を呼ぶ', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderSection({ onDelete });
    await user.click(screen.getByRole('button', { name: 'school_bell を削除' }));
    expect(onDelete).toHaveBeenCalledWith(2);
  });

  it('playingTrackId と一致する行だけ再生中(⏸)表示になる', () => {
    renderSection({ playingTrackId: 2 });
    expect(screen.getByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'school_bell を停止' })).toBeInTheDocument();
  });

  it('行の再生ボタンをクリックすると、その行の id で onTogglePlay を呼ぶ', async () => {
    const user = userEvent.setup();
    const onTogglePlay = vi.fn();
    renderSection({ onTogglePlay });
    await user.click(screen.getByRole('button', { name: 'school_bell を再生' }));
    expect(onTogglePlay).toHaveBeenCalledWith(2);
  });
});
