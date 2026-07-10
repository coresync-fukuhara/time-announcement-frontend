# Agent Tool 管理ツール(MCP・Skill 等)キャッチアップ調査

## 概要
Claude Code などのコーディングエージェントは、MCP サーバー・Skill・Subagent・Hook といった
「拡張パーツ」を組み合わせて能力を広げる。パーツが増えるほど、
どこで何を管理するか(発見・インストール・更新・共有)という課題が出てくる。
この調査では、その課題を解決するツール/仕組みを4つ取り上げ、比較材料を整理する。
**最終判断は利用者自身が行う**ため、本教材では特定のツールを推奨しない。

## 前提知識
- MCP(Model Context Protocol)の基本概念
- Claude Code における Skill(`/name` で呼び出せる手順書)の概念

## 調査対象(4つ)

| ツール | カテゴリ | 開発元 |
| --- | --- | --- |
| Claude Code Plugins & Marketplace | エージェント拡張機能の統合パッケージング(公式) | Anthropic |
| Smithery | MCP レジストリ + ホスティング + 動的接続 | Smithery, Inc.(サードパーティ) |
| Docker MCP Toolkit / Catalog | MCP のコンテナ化実行基盤(セキュリティ重視) | Docker, Inc. |
| install-mcp | 軽量 MCP インストーラー CLI | supermemoryai(OSS) |

## 推奨学習リソース

| リソース | 種別 | URL | 特徴 |
| --- | --- | --- | --- |
| Claude Code Plugins reference | 公式 | https://code.claude.com/docs/en/plugins-reference | プラグインの構成要素(Skills/Agents/Hooks/MCP/LSP/monitors)の技術仕様 |
| Claude Code Plugin marketplaces | 公式 | https://code.claude.com/docs/en/plugin-marketplaces | マーケットプレイスの配布・共有の仕組み |
| Smithery | サードパーティ公式 | https://smithery.ai/ | レジストリ・ホスティング・Toolbox(meta-MCP) |
| Docker MCP Catalog and Toolkit | 公式 | https://docs.docker.com/ai/mcp-catalog-and-toolkit/ | コンテナ分離実行・セキュリティ機能 |
| install-mcp | OSS(GitHub) | https://github.com/supermemoryai/install-mcp | 軽量インストーラーCLIの実装 |

## 推奨学習順序
1. **なぜ管理ツールが必要か** — MCP/Skillが増えたときに起きる課題の整理
2. **Claude Code Plugins & Marketplace** — Skill/Agent/Hook/MCPを1パッケージにまとめる公式の仕組み
3. **Smithery** — サードパーティのMCPレジストリ・ホスティングサービス
4. **Docker MCP Toolkit** — コンテナによる隔離実行とセキュリティ機構
5. **install-mcp** — 何も管理せず「設定への追記」だけを簡略化する最小構成
6. **比較まとめ** — 4者を横並びで比較し、利用者が状況に応じて選べるようにする

## 推定学習時間
半日程度(4ツールの特徴理解 + 比較表の読み込み)
