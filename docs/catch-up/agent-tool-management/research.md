# Agent Tool 管理ツール(MCP・Skill 等)キャッチアップ調査

## 概要
Claude Code などのコーディングエージェントは、MCP サーバー・Skill・Subagent・Hook といった
「拡張パーツ」を組み合わせて能力を広げる。パーツが増えるほど、
どこで何を管理するか(発見・インストール・更新・共有・再現性・ガバナンス)という課題が出てくる。
この調査では、その課題を解決するツール/仕組みを8つ取り上げ、比較材料を整理する。
**最終判断は利用者自身が行う**ため、本教材では特定のツールを推奨しない。

8つは大きく2方向に分かれる。

- **発見・インストール寄り**(前半4つ): レジストリ・マーケットプレイスから探して設定に追記することに力点。
  Claude Code Plugins & Marketplace / Smithery / Docker MCP Toolkit / install-mcp
- **宣言的依存管理・再現性寄り**(後半4つ): npm/pip のように依存を1ファイルに宣言し、lockファイルで固定し、
  誰の環境でも再現することに力点。「Agent Package Manager」という名前そのもののツールもここに含まれる。
  Microsoft APM / Vercel Skills(skills.sh) / agent-sh/agentsys / agentget

後半4つは、「Agent Package Manager という名前のツールはなかったか?」という疑問をきっかけに追加調査した。
当初は別教材として書いたが、「そもそも package manager 級のツールまで必要か」を判断するには
前半の発見・インストール系と並べて比較する必要があるため、本教材に統合した。

## 前提知識
- MCP(Model Context Protocol)の基本概念
- Claude Code における Skill(`/name` で呼び出せる手順書)の概念
- npm/pip などパッケージマネージャーの基本概念(依存宣言・lockfile・transitive dependency) — 後半4つの理解に必要

## 調査対象(8つ)

| ツール | カテゴリ | 開発元 | 方向性 |
| --- | --- | --- | --- |
| Claude Code Plugins & Marketplace | エージェント拡張機能の統合パッケージング(公式) | Anthropic | 発見・インストール |
| Smithery | MCP レジストリ + ホスティング + 動的接続 | Smithery, Inc.(サードパーティ) | 発見・インストール |
| Docker MCP Toolkit / Catalog | MCP のコンテナ化実行基盤(セキュリティ重視) | Docker, Inc. | 発見・インストール |
| install-mcp | 軽量 MCP インストーラー CLI | supermemoryai(OSS) | 発見・インストール(最軽量) |
| Microsoft APM | Skill/Prompt/MCP/Hook等の宣言的依存管理 | Microsoft(元は個人OSSの移管) | 宣言的依存管理・再現性・ガバナンス |
| Vercel Skills(skills.sh) | Skill配布に特化した大規模コミュニティ | Vercel(公式) | 宣言的インストール・大規模流通 |
| agent-sh/agentsys | Plugin/Agent/Skillのバンドル配布 | OSS(コミュニティ) | 宣言的インストール(バンドル配布) |
| agentget | GitHubリポジトリを直接レジストリ化する軽量CLI | OSS(個人、joeyism) | 発見・インストール(最軽量) |

### 信頼性の確認方法(後半4つ)
GitHub の star数・fork数・直近のコミット/リリース頻度・ライセンスの有無・開発元(個人か企業か)を
`gh api repos/<owner>/<repo>` で機械的に確認した。特に **Microsoft APM は元々
`danielmeppiel/apm` という個人開発者のリポジトリだったものが、同一リポジトリID のまま
`microsoft/apm` に移管されている**ことを GitHub API のレポジトリID一致で確認した
(OSSプロジェクトが企業に採用された事例)。

| ツール | GitHub stars(2026-07-11時点) | ライセンス |
| --- | --- | --- |
| Microsoft APM | 3,169 | MIT |
| Vercel Skills(skills.sh) | 25,780 | - |
| agent-sh/agentsys | 890 | MIT |
| agentget | 33 | Apache-2.0 |

### 名前が紛らわしい要注意サービス
調査中、`agentpackagemanager.com`(AgentPM™)という商用サービスも見つかったが、
GitHub リポジトリや第三者レビューが確認できず、開発元の実態を検証する材料が乏しい。
また `agentpm.dev` は名前が似ているが実際はエージェント作業のエビデンス・レビュー支援ツールで
別物。どちらも本教材の「信頼できるツール」には含めない(08で注意点として触れる)。

## 推奨学習リソース

| リソース | 種別 | URL | 特徴 |
| --- | --- | --- | --- |
| Claude Code Plugins reference | 公式 | https://code.claude.com/docs/en/plugins-reference | プラグインの構成要素(Skills/Agents/Hooks/MCP/LSP/monitors)の技術仕様 |
| Claude Code Plugin marketplaces | 公式 | https://code.claude.com/docs/en/plugin-marketplaces | マーケットプレイスの配布・共有の仕組み |
| Smithery | サードパーティ公式 | https://smithery.ai/ | レジストリ・ホスティング・Toolbox(meta-MCP) |
| Docker MCP Catalog and Toolkit | 公式 | https://docs.docker.com/ai/mcp-catalog-and-toolkit/ | コンテナ分離実行・セキュリティ機能 |
| install-mcp | OSS(GitHub) | https://github.com/supermemoryai/install-mcp | 軽量インストーラーCLIの実装 |
| Microsoft APM 公式サイト | 公式 | https://microsoft.github.io/apm/ | apm.yml / apm.lock.yaml の仕様、ガバナンス機能の説明 |
| Microsoft APM GitHub | 公式(OSS) | https://github.com/microsoft/apm | ソースコード・リリースノート |
| Vercel Skills changelog | 公式 | https://vercel.com/changelog/introducing-skills-the-open-agent-skills-ecosystem | skills.sh 発表記事 |
| Vercel Skills GitHub | 公式(OSS) | https://github.com/vercel-labs/skills | `npx skills` の実装 |
| agent-sh/agentsys | OSS(GitHub) | https://github.com/agent-sh/agentsys | Plugin/Agent/Skill バンドルの実装 |
| agentget | OSS(GitHub) | https://github.com/joeyism/agentget | 軽量インストーラーCLIの実装 |

## 推奨学習順序
1. **なぜ管理ツールが必要か** — MCP/Skillが増えたときに起きる課題の整理、「発見・インストール」と
   「宣言的依存管理・再現性」の2方向の整理
2. **Claude Code Plugins & Marketplace** — Skill/Agent/Hook/MCPを1パッケージにまとめる公式の仕組み
3. **Smithery** — サードパーティのMCPレジストリ・ホスティングサービス
4. **Docker MCP Toolkit** — コンテナによる隔離実行とセキュリティ機構
5. **install-mcp** — 何も管理せず「設定への追記」だけを簡略化する最小構成
6. **Microsoft APM** — apm.yml/apm.lock.yaml による宣言的依存管理とガバナンス機能
7. **Vercel Skills(skills.sh)** — Skill配布に特化した大規模コミュニティエコシステム
8. **その他の選択肢と注意点** — agent-sh/agentsys、agentget、名前が紛らわしい商用サービスへの注意
9. **比較まとめ** — 8者を横並びで比較し、「package managerまで必要か」を判断できるようにする

## 推定学習時間
1日程度(8ツールの特徴理解 + 比較表の読み込み)
