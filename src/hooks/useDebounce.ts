import { useState, useEffect } from 'react';

/**
 * 入力値の変更を指定した時間だけ遅延させるカスタムフック
 * @param value 監視する値
 * @param delay 遅延時間（ミリ秒）
 * @returns 遅延後の値
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 指定した遅延時間後に値を更新するタイマーをセット
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // クリーンアップ関数でタイマーをクリア
    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
} 