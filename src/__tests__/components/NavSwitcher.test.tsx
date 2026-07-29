import { render, screen } from '@testing-library/react';
import { NavSwitcher } from '@/components/NavSwitcher';

describe('NavSwitcher', () => {
  it('current="schedule" のとき、スケジュール設定側が aria-current=page になる', () => {
    render(<NavSwitcher current="schedule" />);
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '楽曲管理' })).not.toHaveAttribute('aria-current');
  });

  it('current="tracks" のとき、楽曲管理側が aria-current=page になる', () => {
    render(<NavSwitcher current="tracks" />);
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('スケジュール設定リンクは / を指す', () => {
    render(<NavSwitcher current="tracks" />);
    expect(screen.getByRole('link', { name: 'スケジュール設定' })).toHaveAttribute('href', '/');
  });

  it('楽曲管理リンクは /tracks を指す', () => {
    render(<NavSwitcher current="schedule" />);
    expect(screen.getByRole('link', { name: '楽曲管理' })).toHaveAttribute('href', '/tracks');
  });
});
