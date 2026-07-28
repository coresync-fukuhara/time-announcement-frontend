import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 本番はマルチステージビルドで実行イメージを最小化する(概要設計 8章)。
  output: 'standalone',
  typescript: {
    // Next.js 16.2.10 の型チェック連携(verify-typescript-setup.js)は
    // TypeScript の旧パッケージ構造(typescript/lib/typescript.js)を前提にしており、
    // TypeScript 7 系(Go 移植版。exports が ./unstable/* 等に全面刷新され、
    // 当該ファイルが存在しない)を認識できず `next build` がクラッシュする
    // (既知の非互換。アプリコードの型エラーではない)。
    // 型チェック自体は `pnpm exec tsc --noEmit` で別途行うため、ここでは無効化する。
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
