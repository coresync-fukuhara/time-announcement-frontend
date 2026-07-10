# Node.js テストフレームワーク キャッチアップ調査

## 概要
Next.js(App Router)+ React 19 + TypeScript 構成のプロジェクトで TDD を導入するにあたり、
2025〜2026 年時点で Node.js / React エコシステムでよく使われているテストツールを調査した。
「ユニット/コンポーネント」「API(Route Handlers)」「E2E」の 3 層で、それぞれ標準的な組み合わせが存在する。

## 前提知識
- TypeScript の基本文法
- npm/pnpm によるパッケージ管理
- Next.js App Router の基本構成(`app/` 配下のページ・Route Handlers)
- テストの基本用語(ユニットテスト・モック・スタブ・E2E)

## 推奨学習リソース

| リソース | 種別 | URL | 特徴 |
| --- | --- | --- | --- |
| Vitest 公式ドキュメント | 公式 | https://vitest.dev/ | API リファレンス・設定方法 |
| Next.js Testing (Vitest) ガイド | 公式 | https://nextjs.org/docs/app/guides/testing/vitest | Next.js 公式が示す Vitest セットアップ手順 |
| Next.js Testing 概要 | 公式 | https://nextjs.org/docs/app/guides/testing | Jest/Vitest/Playwright/Cypress 全体の位置づけ |
| Testing Library 公式ドキュメント | 公式 | https://testing-library.com/docs/react-testing-library/intro/ | コンポーネントテストの書き方(ユーザー視点の API) |
| Playwright 公式ドキュメント | 公式 | https://playwright.dev/ | E2E テストのセットアップ・API |
| MSW(Mock Service Worker)公式ドキュメント | 公式 | https://mswjs.io/docs/ | ネットワークレベルでの API モック |
| next-test-api-route-handler(NTARH) | コミュニティ(npm) | https://github.com/Xunnamius/next-test-api-route-handler | Route Handlers を分離環境でテストするためのヘルパー |
| State of JavaScript 2025 — Testing | コミュニティ調査 | https://2025.stateofjs.com/en-US/libraries/testing/ | 利用率・満足度の実データ |

## 推奨学習順序
1. **Vitest の基本** — `describe`/`it`/`expect` など Jest 互換 API でのユニットテストの書き方
2. **React Testing Library との組み合わせ** — `render`/`screen`/`userEvent` を使ったコンポーネントテスト
3. **Next.js 特有の注意点** — `next/navigation` のモック、非同期 Server Component は Vitest でテスト不可(E2E に委譲)
4. **Route Handlers のテスト** — NTARH または直接ハンドラー関数を呼び出す方式、`vi.mock`/`vi.spyOn` の使い分け
5. **MSW によるモック** — 外部 HTTP 呼び出しをネットワークレベルでインターセプトする方法
6. **Playwright での E2E** — ブラウザ経由の疎通確認、初期化ダイアログや保存フローなど画面をまたぐシナリオ

## 推定学習時間
- 基本(Vitest + RTL でのユニット/コンポーネントテスト): 半日程度
- Route Handlers のテスト + MSW: 半日程度
- Playwright E2E の基本セットアップ: 半日程度
- 合計: 1.5〜2 日程度で実践投入可能なレベルに到達見込み
