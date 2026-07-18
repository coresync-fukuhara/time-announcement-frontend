import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';

// MSW: 外部 API モック用のサーバーを全テストで起動する(テスト設計 3章)。
// 現状は外部 API 通信が無いためハンドラは空だが、将来の外部連携に備えて基盤を用意する。
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
