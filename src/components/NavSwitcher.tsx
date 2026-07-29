import styles from './NavSwitcher.module.css';

export interface NavSwitcherProps {
  current: 'schedule' | 'tracks';
}

// ヘッダー右のアイコン切替(🕐 スケジュール設定 / 🎵 楽曲管理)。プレーンな <a> による
// フルページ遷移にする(2画面間の行き来は頻繁ではないため、クライアント側ルーティングの
// 複雑さをあえて避ける。画面詳細設計 4.1節)。
export function NavSwitcher({ current }: NavSwitcherProps) {
  return (
    <div className={styles.switcher} role="group" aria-label="画面切替">
      <a
        href="/"
        aria-label="スケジュール設定"
        aria-current={current === 'schedule' ? 'page' : undefined}
        className={current === 'schedule' ? `${styles.link} ${styles.linkActive}` : styles.link}
      >
        🕐
      </a>
      <a
        href="/tracks"
        aria-label="楽曲管理"
        aria-current={current === 'tracks' ? 'page' : undefined}
        className={current === 'tracks' ? `${styles.link} ${styles.linkActive}` : styles.link}
      >
        🎵
      </a>
    </div>
  );
}
