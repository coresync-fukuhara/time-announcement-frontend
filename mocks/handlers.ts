import type { RequestHandler } from 'msw';

// 外部 API のモックハンドラ。現状は外部通信が無いため空。
// 将来、通知 API などの外部連携を追加する際にここへハンドラを足す(テスト設計 3章)。
export const handlers: RequestHandler[] = [];
