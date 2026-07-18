import path from 'node:path';

// settings ディレクトリはハードコードせず SETTINGS_DIR で受け取る(概要設計 8章)。
// 開発時(devcontainer)は未設定なら cwd 直下の settings/ を使う。
// 本番(Docker)は named volume をマウントした /data/settings を指す。
export function getSettingsDir(): string {
  const dir = process.env.SETTINGS_DIR;
  return dir && dir.length > 0 ? dir : path.join(process.cwd(), 'settings');
}

export function getSchemaPath(): string {
  return path.join(getSettingsDir(), 'schema.json');
}

export function getSchedulesPath(): string {
  return path.join(getSettingsDir(), 'schedules.json');
}

// 保存前に 1 世代だけ残すバックアップ(No.11 確定)。
export function getBackupPath(): string {
  return path.join(getSettingsDir(), 'schedules.json.bak');
}

// アトミック書き込み用の一時ファイル(同一ディレクトリに置く。概要設計 7章)。
export function getTmpPath(): string {
  return path.join(getSettingsDir(), '.schedules.json.tmp');
}
