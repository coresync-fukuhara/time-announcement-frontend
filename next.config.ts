import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 本番はマルチステージビルドで実行イメージを最小化する(概要設計 8章)。
  output: 'standalone',
};

export default nextConfig;
