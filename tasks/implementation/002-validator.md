# 002: `lib/validator.ts`(Ajv バリデータ)の実装

- ステータス: 未着手
- 関連文書: [概要設計書](../../docs/schedule-ui-overview-design.md) 3.2節・7章、[テスト設計書](../../docs/schedule-ui-testing-design.md) 4.1節

## 概要

既存の `settings/schema.json`(draft-07)を Ajv でコンパイルし、
スケジュールデータを検証するラッパーを実装する。TDD で先にテストを書く。

## 完了条件

- [ ] `lib/validator.ts` が `settings/schema.json` をコンパイルして検証関数を提供する
- [ ] 妥当なスケジュールデータで検証が成功する
- [ ] 不正なスケジュールデータで Ajv のエラー配列を返す
- [ ] ユニットテスト(Vitest)が green
