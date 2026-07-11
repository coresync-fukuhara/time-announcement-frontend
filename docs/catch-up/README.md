# キャッチアップ教材

各設計書での技術選定の調査過程をまとめた学習用インデックスです。
各ディレクトリの `index.html` から `concepts/` 配下の各トピックへリンクしています。

| ディレクトリ | 内容 | 関連する設計書 |
| --- | --- | --- |
| [mcp-servers/](./mcp-servers) | 採用フレームワークの公式 MCP サーバー(Playwright MCP / Next.js DevTools MCP) | [MCP サーバー導入設計書](../mcp-servers-design.md) |
| [nodejs-test-frameworks/](./nodejs-test-frameworks) | Node.js テストフレームワーク(Vitest / RTL / Route Handlers / MSW / Playwright) | [テスト設計書](../schedule-ui-testing-design.md) |
| [agent-tool-management/](./agent-tool-management) | Agent Tool 管理ツール(MCP・Skill の発見・インストール系4つ + Microsoft APM 等の宣言的依存管理系4つ) | [MCP サーバー導入設計書](../mcp-servers-design.md) |
| [claude-code-plugins-skills-hooks/](./claude-code-plugins-skills-hooks) | 本プロジェクトに有用そうな Claude Code Plugin/Skill/Hook のカタログ(公式・高star限定、APM未追加) | 特定の設計書には非連動(agent-tool-management/ の関連教材) |

各ディレクトリの `research.md` に調査メモ、`index.html` に学習インデックスがあります。
