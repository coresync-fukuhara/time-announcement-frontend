# 004: MCP サーバー導入設計書の作成

- ステータス: 完了
- 関連文書: [MCP サーバー導入設計書](../../docs/mcp-servers-design.md)

## 概要

採用フレームワーク(Next.js, React, Vitest, Playwright, MSW, Ajv)について、
開発元が公式に MCP サーバーを公開しているかを調査し、開発時にエージェントが
接続する MCP サーバーを選定する。

## 完了条件

- [x] 各フレームワークの公式 MCP サーバーの有無を調査する
- [x] 採否を判定する(Playwright MCP・Next.js DevTools MCP を採用)
- [x] 採用した MCP サーバーの役割分担を整理する
- [x] `.mcp.json` に反映する
