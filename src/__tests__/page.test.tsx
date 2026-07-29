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
});
