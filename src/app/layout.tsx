import type { ReactNode } from 'react';

export const metadata = {
  title: 'タイムアナウンスメント 設定',
  description: 'schedules.json をブラウザから編集するフロントエンド',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
