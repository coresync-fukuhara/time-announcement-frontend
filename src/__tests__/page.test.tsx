import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Home from '@/app/page';

const baseSchedules = {
  monday: [{ hour: 9, minutes: [0] }],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  holiday: [],
};

function jsonResponse(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe('Home ページ', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('読み込み後、既存のスケジュールを確認(閲覧)モードで表示する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ initialized: true, schedules: baseSchedules })),
    );
    render(<Home />);
    expect(await screen.findByRole('tab', { name: '月' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '9時00分' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('href', '/tracks');
  });

  it('未初期化の場合は初期化ダイアログを表示し、「空で始める」を選ぶと編集モードで開始する(No.9)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ initialized: false })));
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByText('schedules.json が見つかりません');
    await user.click(screen.getByRole('button', { name: /空の週間スケジュールで始める/ }));
    expect(await screen.findByRole('button', { name: '保存' })).toBeInTheDocument();
    expect(screen.getByText(/この曜日にはまだ時間が設定されていません/)).toBeInTheDocument();
  });

  it('トグルして保存に成功すると確認モードへ戻る', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '9時30分' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByRole('button', { name: '編集' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/schedules',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('初期読み込みに失敗した場合はエラー表示にし、ヘッダー(NavSwitcher)は表示され続ける', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, false)));
    render(<Home />);
    expect(
      await screen.findByText('読み込みに失敗しました。ページを再読み込みしてください。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('href', '/tracks');
  });

  it('保存がバリデーションエラーの場合は画面遷移せずエラー内容をダイアログで表示する', async () => {
    const details = [{ instancePath: '/monday/0/hour', message: 'must be <= 23' }];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ error: 'validation_failed', details }, false));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '保存' }));
    expect(await screen.findByText('保存に失敗しました')).toBeInTheDocument();
    expect(screen.getByText(/must be <= 23/)).toBeInTheDocument();
    // 画面遷移していない(編集モードのまま「保存」ボタンが残る)
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });

  it('分バッジでタイプを指定すると保存時にminute_settingsへ反映される', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ tracks: [] }))
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    await screen.findByRole('dialog', { name: '音の割り当て' });
    await user.click(screen.getByRole('button', { name: 'タイプで指定' }));
    await user.click(screen.getByRole('button', { name: 'ALARM' }));
    await user.click(screen.getByRole('button', { name: '適用' }));
    expect(screen.queryByRole('dialog', { name: '音の割り当て' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '9時00分: タイプ ALARM(クリックで変更)' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '保存' }));
    await screen.findByRole('button', { name: '編集' });

    const putCall = fetchMock.mock.calls.find(
      ([url, init]) => url === '/api/schedules' && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.monday[0].minute_settings).toEqual({
      '0': { sound_file_name: '', sound_types: ['ALARM'] },
    });
  });

  it('ダイアログをキャンセルしても未保存インジケーターは出ない', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ tracks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    await screen.findByRole('dialog', { name: '音の割り当て' });
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));
    expect(screen.queryByRole('dialog', { name: '音の割り当て' })).not.toBeInTheDocument();
    expect(screen.queryByText('未保存の変更があります')).not.toBeInTheDocument();
  });

  it('音割り当てダイアログが開いている状態で対象時間を削除してもクラッシュしない', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ initialized: true, schedules: baseSchedules }))
      .mockResolvedValueOnce(jsonResponse({ tracks: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(<Home />);
    await screen.findByRole('tab', { name: '月' });
    await user.click(screen.getByRole('button', { name: '編集' }));

    // 9時00分の音割り当てダイアログを開く
    await user.click(screen.getByRole('button', { name: '9時00分の音を割り当てる' }));
    await screen.findByRole('dialog', { name: '音の割り当て' });

    // 9時の行を削除し、確認ダイアログで削除を確認
    await user.click(screen.getByRole('button', { name: '9時の行を削除' }));
    await user.click(screen.getByRole('button', { name: '削除する' }));

    // ページが崩れず、ダイアログが安全な状態(未設定の状態で)残っていることを確認
    const dialog = screen.getByRole('dialog', { name: '音の割り当て' });
    expect(dialog).toBeInTheDocument();
    // ダイアログのモード選択で「未設定」が選ばれていることを確認
    const modeButtons = screen.getAllByRole('button').filter((btn) => btn.textContent === '未設定');
    expect(modeButtons.some((btn) => btn.getAttribute('aria-pressed') === 'true')).toBe(true);
    // 削除した9時が消えていることを確認
    expect(screen.queryByRole('button', { name: /^9時[0-5][0-9]分$/ })).not.toBeInTheDocument();
    // ページが正常に表示されている
    expect(screen.getByRole('button', { name: '保存' })).toBeInTheDocument();
  });
});
