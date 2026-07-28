import { render, screen } from '@testing-library/react';
import { CopyDiff } from '@/components/CopyDiff';

describe('CopyDiff', () => {
  it('曜日名の見出しと、変更のある時間帯を表示する', () => {
    render(
      <CopyDiff
        dayLabel="土"
        rows={[
          { hour: 9, beforeText: '―', afterText: '00,30', status: 'added' },
          { hour: 14, beforeText: '00', afterText: '―', status: 'removed' },
        ]}
      />,
    );
    expect(screen.getByText('土曜日')).toBeInTheDocument();
    expect(screen.getByText('9時')).toBeInTheDocument();
    expect(screen.getByText('00,30')).toBeInTheDocument();
    expect(screen.getByText('14時')).toBeInTheDocument();
  });

  it('差分が無い場合は変更なしのメッセージを表示する', () => {
    render(<CopyDiff dayLabel="日" rows={[]} />);
    expect(screen.getByText('日曜日')).toBeInTheDocument();
    expect(screen.getByText(/変更はありません/)).toBeInTheDocument();
  });
});
