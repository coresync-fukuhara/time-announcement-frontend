import { render, screen } from '@testing-library/react';

// テスト基盤(Vitest + React Testing Library + jest-dom)の疎通確認。
describe('テスト基盤の疎通', () => {
  it('RTL でレンダリングし jest-dom マッチャが使える', () => {
    render(<h1>ok</h1>);
    expect(screen.getByRole('heading', { name: 'ok' })).toBeInTheDocument();
  });
});
