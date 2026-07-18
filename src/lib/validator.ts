import { readFileSync } from 'node:fs';
import { Ajv, type ErrorObject, type ValidateFunction } from 'ajv';
import { getSchemaPath } from './paths';

export type ValidationResult =
  | { valid: true; errors: null }
  | { valid: false; errors: ErrorObject[] };

// スキーマのコンパイルはコストがあるため、スキーマパス単位でキャッシュする。
let cache: { schemaPath: string; validate: ValidateFunction } | null = null;

function getValidate(): ValidateFunction {
  const schemaPath = getSchemaPath();
  if (cache && cache.schemaPath === schemaPath) {
    return cache.validate;
  }
  const schema: unknown = JSON.parse(readFileSync(schemaPath, 'utf-8'));
  // schema.json は backend 側リポジトリが管理する外部資産のため、
  // 未知キーワード等で落とさないよう strict は無効にする(概要設計 3.2)。
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);
  cache = { schemaPath, validate };
  return validate;
}

// スケジュールデータを settings/schema.json で検証する。
// 妥当なら valid: true、違反なら Ajv のエラー配列を返す(タスク 002 完了条件)。
export function validateSchedules(data: unknown): ValidationResult {
  const validate = getValidate();
  const valid = validate(data);
  if (valid) {
    return { valid: true, errors: null };
  }
  return { valid: false, errors: validate.errors ?? [] };
}

// SETTINGS_DIR の切り替えやスキーマ更新に追随するためのキャッシュ破棄(主にテスト用)。
export function resetValidatorCache(): void {
  cache = null;
}
