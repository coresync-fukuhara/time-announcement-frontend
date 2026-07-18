import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // tsconfig の paths(@/* → src/*)は Vite ネイティブ解決を使う。
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // ユニット/コンポーネントの既定環境は jsdom(テスト設計 4.1)。
    // ファイル I/O や Route Handler を扱うテストは各ファイル冒頭の
    //   // @vitest-environment node
    // で node 環境に切り替える(テスト設計 4.2)。
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // E2E(Playwright)は Vitest の対象外。
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
