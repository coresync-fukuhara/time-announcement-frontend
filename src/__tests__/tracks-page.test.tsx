import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TracksPage from '@/app/tracks/page';
import type { Track, TrackAudioType } from '@/lib/types';

const audioTypes: TrackAudioType[] = [
  { id: 1, name: 'DEFAULT' },
  { id: 2, name: 'NOTIFICATION' },
];

const userTrack: Track = {
  id: 1,
  name: 'chime_intro',
  filePath: '/data/sounds/user/chime_intro.wav',
  origin: 'user',
  audioTypes: [{ id: 1, name: 'DEFAULT' }],
};

const defaultTrack: Track = {
  id: 2,
  name: 'default_chime',
  filePath: '/data/sounds/default/default_chime.wav',
  origin: 'default',
  audioTypes: [],
};

const anotherUserTrack: Track = {
  id: 3,
  name: 'school_bell',
  filePath: '/data/sounds/user/school_bell.wav',
  origin: 'user',
  audioTypes: [],
};

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return { ok, status, json: async () => body } as Response;
}

function noContentResponse(): Response {
  return { ok: true, status: 204, json: async () => ({}) } as Response;
}

function stubInitialLoad(fetchMock: ReturnType<typeof vi.fn>, tracks: Track[]) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse({ tracks }))
    .mockResolvedValueOnce(jsonResponse({ audioTypes }));
}

describe('楽曲管理画面', () => {
  beforeEach(() => {
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.pause = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('読み込み後、user 楽曲は「アップロード済み」、それ以外は「初期音源・その他」に表示する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack, defaultTrack]);
    vi.stubGlobal('fetch', fetchMock);

    render(<TracksPage />);

    expect(await screen.findByText('chime_intro')).toBeInTheDocument();
    const uploadedSection = screen.getByRole('heading', { name: 'アップロード済み' }).closest('section')!;
    const otherSection = screen
      .getByRole('heading', { name: '初期音源・その他(名前変更・削除不可)' })
      .closest('section')!;
    expect(uploadedSection).toHaveTextContent('chime_intro');
    expect(otherSection).toHaveTextContent('default_chime');
  });

  it('読み込みに失敗した場合はエラー表示にする', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, false));
    vi.stubGlobal('fetch', fetchMock);
    render(<TracksPage />);
    expect(
      await screen.findByText('読み込みに失敗しました。ページを再読み込みしてください。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).toHaveAttribute('href', '/');
  });

  it('アップロード成功時、一覧に新しい楽曲が追加される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const newTrack: Track = {
      id: 3,
      name: 'new_upload',
      filePath: '/data/sounds/user/new_upload.wav',
      origin: 'user',
      audioTypes: [],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: newTrack }, true, 201));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    const input = screen.getByLabelText('ファイルを選択');
    const file = new File([new Uint8Array(10)], 'new_upload.wav', { type: 'audio/wav' });
    await user.upload(input, file);

    expect(await screen.findByText('new_upload')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tracks', expect.objectContaining({ method: 'POST' }));
  });

  it('アップロードの拡張子エラーは ErrorDialog に表示される(クライアント側事前チェック)', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    // accept=".wav" によるブラウザ/testing-library側のファイルフィルタを無効化し、
    // コンポーネント自身の拡張子検証ロジックを実際に通過させる。
    const user = userEvent.setup({ applyAccept: false });

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    const input = screen.getByLabelText('ファイルを選択');
    await user.upload(input, new File(['x'], 'chime.mp3', { type: 'audio/mpeg' }));

    expect(await screen.findByText('アップロードに失敗しました')).toBeInTheDocument();
    expect(screen.getByText('.wav 形式のファイルのみアップロードできます。')).toBeInTheDocument();
    // アップロードの POST は呼ばれていない(初期読み込みの2回だけ)
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('アップロードのサーバーエラーは ErrorDialog に表示され、一覧に追加されない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'conflict', field: 'name' }, false, 409));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    const input = screen.getByLabelText('ファイルを選択');
    const file = new File([new Uint8Array(10)], 'dup_name.wav', { type: 'audio/wav' });
    await user.upload(input, file);

    expect(await screen.findByText('アップロードに失敗しました')).toBeInTheDocument();
    expect(screen.getByText('同じ表示名の楽曲が既に存在します。')).toBeInTheDocument();
    expect(screen.queryByText('dup_name')).not.toBeInTheDocument();
  });

  it('名前変更に成功すると一覧に反映される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const renamed: Track = { ...userTrack, name: 'renamed_chime' };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: renamed }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'renamed_chime{Enter}');

    expect(await screen.findByText('renamed_chime')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/tracks/1',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'renamed_chime', audioTypeIds: [1] }),
      }),
    );
  });

  it('名前変更に失敗すると ErrorDialog を表示し、名前は変わらない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'conflict', field: 'name' }, false, 409));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro(クリックして名前を変更)' }));
    const input = screen.getByLabelText('楽曲名');
    await user.clear(input);
    await user.type(input, 'dup_name{Enter}');

    expect(await screen.findByText('名前の変更に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('同じ表示名の楽曲が既に存在します。')).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
  });

  it('音声タイプを切り替えると現在の名前とともにPATCHし、一覧に反映される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    const updated: Track = {
      ...userTrack,
      audioTypes: [
        { id: 1, name: 'DEFAULT' },
        { id: 2, name: 'NOTIFICATION' },
      ],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse({ track: updated }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/tracks/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'chime_intro', audioTypeIds: [1, 2] }),
        }),
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
  });

  it('音声タイプの切り替えに失敗すると ErrorDialog を表示し、切り替わらない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }, false, 403));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' }));

    expect(await screen.findByText('音声タイプの変更に失敗しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'chime_intro NOTIFICATION' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('削除は確認ダイアログを経てから実行され、成功すると一覧から消える', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(noContentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    expect(screen.getByText('この操作は取り消せません。よろしいですか?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => expect(screen.queryByText('chime_intro')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenLastCalledWith('/api/tracks/1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('削除に失敗すると ErrorDialog を表示し、一覧からは消えない', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'forbidden' }, false, 403));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    expect(await screen.findByText('削除に失敗しました')).toBeInTheDocument();
    expect(screen.getByText('chime_intro')).toBeInTheDocument();
  });

  it('再生中の楽曲を削除すると、共有プレイヤーも停止し playingId がクリアされる', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    fetchMock.mockResolvedValueOnce(noContentResponse());
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const pauseSpy = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseSpy;

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    await screen.findByRole('button', { name: 'chime_intro を停止' });

    await user.click(screen.getByRole('button', { name: 'chime_intro を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    await waitFor(() => expect(screen.queryByText('chime_intro')).not.toBeInTheDocument());
    expect(pauseSpy).toHaveBeenCalled();
  });

  it('再生ボタンをクリックすると音声を再生し、アイコンが⏸に切り替わる', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const playSpy = vi.fn().mockResolvedValue(undefined);
    window.HTMLMediaElement.prototype.play = playSpy;

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));

    expect(playSpy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'chime_intro を停止' })).toBeInTheDocument();
    const audio = screen.getByTestId('track-preview-audio') as HTMLAudioElement;
    expect(audio.src).toContain('/api/tracks/1/audio');
  });

  it('再生中に同じ行のボタンをクリックすると停止する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const pauseSpy = vi.fn();
    window.HTMLMediaElement.prototype.pause = pauseSpy;

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    await screen.findByRole('button', { name: 'chime_intro を停止' });
    await user.click(screen.getByRole('button', { name: 'chime_intro を停止' }));

    expect(pauseSpy).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
  });

  it('再生エラー時は ErrorDialog を表示し、再生中状態を解除する', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    const audio = screen.getByTestId('track-preview-audio');
    audio.dispatchEvent(new Event('error'));

    expect(await screen.findByText('再生に失敗しました')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
  });

  it('再生が自然終了(onEnded)すると、再生中状態が解除される', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    await screen.findByRole('button', { name: 'chime_intro を停止' });
    const audio = screen.getByTestId('track-preview-audio');
    audio.dispatchEvent(new Event('ended'));

    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
  });

  it('別の行の再生ボタンをクリックすると、前の再生が止まり新しい行の再生に切り替わる', async () => {
    const fetchMock = vi.fn();
    stubInitialLoad(fetchMock, [userTrack, anotherUserTrack]);
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    render(<TracksPage />);
    await screen.findByText('chime_intro');

    await user.click(screen.getByRole('button', { name: 'chime_intro を再生' }));
    expect(await screen.findByRole('button', { name: 'chime_intro を停止' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'school_bell を再生' }));

    expect(await screen.findByRole('button', { name: 'chime_intro を再生' })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'school_bell を停止' })).toBeInTheDocument();
    const audio = screen.getByTestId('track-preview-audio') as HTMLAudioElement;
    expect(audio.src).toContain('/api/tracks/3/audio');
  });
});
