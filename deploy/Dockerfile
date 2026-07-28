# syntax=docker/dockerfile:1
#
# ビルドコンテキストはリポジトリ直下(deploy/docker-compose.yaml の build.context: ..)。
# COPY の相対パスはすべてリポジトリ直下基準。

FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# settings named volume の所有権は backend 側リポジトリが管理し、このリポジトリ側では
# 関知しない(deploy/002 確定)。UID を合わせる調整をしないため root のまま実行する
# (家庭内 LAN・認証なし運用で、コンテナ内 root のリスクは小さいと判断)。
# public/ は現状未使用(存在しない場合は次回追加時にこの COPY 行も足すこと)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
