# 001: frontend/ の Next.js プロジェクト作成

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 3章・9章、[テスト設計書](../../docs/schedule-ui-testing-design.md) 3章・6章

## 概要

リポジトリ直下に `frontend/` を新設し、TypeScript + Next.js(App Router) +
React 19 のプロジェクトを作成する。テスト基盤(Vitest, React Testing Library,
next-test-api-route-handler, MSW, Playwright)も併せてセットアップする。
既存の Python プロジェクト(`src/`, `settings/`)とは分離する。

## 完了条件

- [ ] `frontend/` に Next.js(App Router)プロジェクトが作成されている
- [ ] `output: 'standalone'` が設定されている(008 で使用)
- [ ] Vitest / React Testing Library / next-test-api-route-handler / MSW / Playwright が導入され、
      それぞれの最小限のサンプルテストが green で通る
- [ ] `npm run test` / `npm run test:e2e` が実行できる(テスト設計書 7章)
