# Claude Code Plugin/Skill/Hook キャッチアップ調査

## 概要
このリポジトリ(Next.js + React + TypeScript、Vitest/RTL/Playwright/MSW/Ajv、
devcontainer + Claude Code)に有用そうな Claude Code の **Plugin・Skill・Hook** を調査し、
比較材料としてまとめる。**公式(Anthropic/Vercel等)または GitHub star 数が多く信頼できるものだけ**
を対象とした。調査時点では **APM(`apm.yml`)への追加は行わない**(調査・カタログ化のみ)方針だったが、
後日ユーザーの指示により、Anthropic公式プラグイン7つ
(frontend-design・feature-dev・pr-review-toolkit・commit-commands・claude-md-management・
hookify・security-guidance)を `apm install anthropics/claude-plugins-official/plugins/<name>
--target claude` で実際に `apm.yml` に追加した。`typescript-lsp` のみ、`marketplace.json` の
`lspServers` フィールドとして定義される特殊形式でAPMの汎用インストーラでは扱えず、
Claude Code純正の `/plugin install typescript-lsp@claude-plugins-official` が必要。

## 前提知識
- [agent-tool-management/](../agent-tool-management/) — MCP/Skill 管理ツール一般の基礎
- Plugin(Skill+Agent+Hook+MCP+LSP等をまとめた配布単位)・Skill(`/name`で呼べる手順書)・
  Hook(ツール呼び出し前後に走るシェルコマンド)の違い

## 調査方法
1. Anthropic公式マーケットプレイス `anthropics/claude-plugins-official` の
   `marketplace.json`(255プラグイン)を取得し、このプロジェクトのスタックに関連するキーワード
   (typescript, react, next, test, lint, format, frontend, code-review 等)でフィルタ
2. 各候補の `author`/`source` フィールドで一次配布元(Anthropic公式か、外部かつ何者か)を確認
3. サードパーティ候補は `gh api repos/<owner>/<repo>`(または GitHub REST API)で
   star数・fork数・直近更新日・ライセンス・アーカイブ状態を機械的に確認
4. Vercel/Next.js 関連は `vercel-labs/agent-skills`・`vercel/next.js` の公式リポジトリを直接調査

## 調査対象と信頼性確認結果

### A. Anthropic公式マーケットプレイス(`anthropics/claude-plugins-official`、全て `author: Anthropic`)

| プラグイン | 概要 |
| --- | --- |
| `typescript-lsp` | TypeScript/JavaScript 言語サーバーによるコード解析強化 |
| `frontend-design` | 高品質なフロントエンドUI実装を支援 |
| `feature-dev` | コードベース探索・設計・品質レビューの専門エージェントを備えた機能開発ワークフロー |
| `pr-review-toolkit` | コメント・テスト・エラー処理・型設計・簡潔化に特化したPRレビューエージェント群 |
| `commit-commands` | commit/push/PR作成のgitワークフローを簡略化するコマンド |
| `claude-md-management` | CLAUDE.md の品質監査・セッション学習の記録・鮮度維持 |
| `hookify` | 会話パターン分析や明示指示から Hook を作成する仕組み |
| `security-guidance` | パターンベースの警告 + LLMによるdiffレビュー + コミットレビューで25種以上の脆弱性を検出 |
| `skill-creator` | 新規Skillの作成・既存Skillの改善・性能計測 |

### B. Vercel/Next.js公式(高star)

| リポジトリ | stars(2026-07-11) | 内容 |
| --- | --- | --- |
| `vercel-labs/agent-skills` | 28,924 | Vercel公式Skill集。`react-best-practices`(React/Next.jsパフォーマンス最適化)、
`composition-patterns`(コンポーネント設計)、`web-design-guidelines`(UI/アクセシビリティレビュー)等 |
| `vercel/next.js`(本体リポジトリの`/skills`) | 140,802 | Next.js公式Skillはフレームワーク本体に統合され、
バージョン追従する形に変更された。`next-dev-loop`(実行中の`next dev`をNext.js DevTools MCP + ブラウザ操作で検証)、
`next-cache-components-adoption`/`next-cache-components-optimizer`(Cache Components導入・最適化) |

### C. サードパーティだが公式マーケットプレイス掲載・高star

| リポジトリ | stars(2026-07-11) | 内容 |
| --- | --- | --- |
| `obra/superpowers` | 252,008 | エージェント向けSkillフレームワーク。ブレインストーミング・
サブエージェント駆動開発(組み込みコードレビュー付き)・体系的デバッグ・red/green TDDを提供。
Anthropic公式マーケットプレイスに特定コミットSHAで採録されている |

### D. 検討したが対象外にしたもの(不採用理由)

| リポジトリ | stars | 不採用理由 |
| --- | --- | --- |
| `ryanlewis/claude-format-hook` | 4 | star数が少なすぎる |
| `bartolli/claude-code-typescript-hooks` | 178 | star数が中途半端。同等機能は公式`hookify`で代替できる |
| `wsimmonds/claude-nextjs-skills` | 108 | 個人のPoCリポジトリ。Next.js公式Skillが`vercel/next.js`本体に統合されたため不要 |
| `lackeyjb/playwright-skill` | 2,889 | star数は十分だが、本プロジェクトは既にPlaywright MCP(`.mcp.json`/`apm.yml`)を
採用済みで役割が重複するため様子見 |

## 推奨学習リソース

| リソース | 種別 | URL |
| --- | --- | --- |
| Discover and install prebuilt plugins | 公式 | https://code.claude.com/docs/en/discover-plugins |
| Automate actions with hooks | 公式 | https://code.claude.com/docs/en/hooks-guide |
| claude-plugins-official marketplace.json | 公式(GitHub) | https://github.com/anthropics/claude-plugins-official |
| Vercel Agent Skills | 公式(GitHub) | https://github.com/vercel-labs/agent-skills |
| Next.js Skills(本体統合後) | 公式(GitHub) | https://github.com/vercel/next.js/tree/canary/skills |
| superpowers | 公式マーケットプレイス掲載(GitHub) | https://github.com/obra/superpowers |

## 推奨学習順序
1. **なぜ・何を調べたか** — Plugin/Skill/Hookの違い、調査方針(公式or高star限定、apm未追加)
2. **Anthropic公式マーケットプレイスの厳選プラグイン** — 9つを紹介
3. **Vercel/Next.js公式Skill** — react-best-practices, composition-patterns, next-dev-loop等
4. **superpowers(TDD特化)** — 本プロジェクトのTDD方針との親和性
5. **比較まとめ** — 導入優先度・見送り候補・注意点

## 推定学習時間
半日程度
