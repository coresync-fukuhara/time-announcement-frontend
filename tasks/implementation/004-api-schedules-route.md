# 004: `app/api/schedules/route.ts`(GET/PUT)の実装

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 6章、[テスト設計書](../../docs/schedule-ui-testing-design.md) 4.2節

## 概要

Next.js Route Handlers で BFF の API を実装する。`lib/schedule-store.ts` と
`lib/validator.ts` を利用する。

## 完了条件

- [ ] GET `/api/schedules`: ファイルが存在する場合は内容を返す
- [ ] GET `/api/schedules`: 存在しない/バリデーションエラーの場合は `initialized: false` を返す
- [ ] PUT `/api/schedules`: リクエストボディを検証し、成功時は書き込んで `200` + 保存後の内容を返す
- [ ] PUT `/api/schedules`: スキーマ違反時は `400 { "error": "validation_failed", "details": [...] }` を返し、ファイルに書き込まない
- [ ] PUT `/api/schedules`: ファイル I/O 失敗時は `500 { "error": "io_error" }` を返す
- [ ] 認証・楽観ロックは実装しない(確定事項 No.4・No.5)
- [ ] API テスト(Vitest + next-test-api-route-handler)が green
