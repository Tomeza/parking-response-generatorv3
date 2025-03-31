/**
 * 日付検出と繁忙期チェックのためのユーティリティ関数
 */
import { prisma } from './db';
import { SeasonalInfo } from '@prisma/client';

/**
 * テキストから日付を抽出する関数
 * 
 * @param text 検索対象のテキスト
 * @returns 抽出された日付の配列（Date型）
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  
  // 日付パターンの定義
  const patterns = [
    // 2024年3月15日
    /(\d{4})年(\d{1,2})月(\d{1,2})日/g,
    // 3月15日
    /(\d{1,2})月(\d{1,2})日/g,
    // 2024/3/15
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/g,
    // 3/15
    /(\d{1,2})\/(\d{1,2})/g,
    // 2024-3-15
    /(\d{4})-(\d{1,2})-(\d{1,2})/g,
    // 3-15
    /(\d{1,2})-(\d{1,2})/g
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let year = new Date().getFullYear();
      let month = parseInt(match[1]);
      let day = parseInt(match[2]);
      
      // パターンによって引数の位置が異なる
      if (match.length === 4) {
        year = parseInt(match[1]);
        month = parseInt(match[2]);
        day = parseInt(match[3]);
      }
      
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        dates.push(date);
      }
    }
  });
  
  return dates;
}

/**
 * 日付が繁忙期に該当するかチェックする関数
 * 
 * @param date チェックする日付
 * @returns 繁忙期情報（該当する場合）または null（該当しない場合）
 */
export async function checkBusyPeriod(date: Date): Promise<SeasonalInfo | null> {
  try {
    // 日付をYYYY-MM-DD形式に変換
    const formattedDate = date.toISOString().split('T')[0];
    
    // 繁忙期テーブルから該当する期間を検索
    const busyPeriod = await prisma.seasonalInfo.findFirst({
      where: {
        info_type: 'busy_period',
        start_date: {
          lte: new Date(formattedDate)
        },
        end_date: {
          gte: new Date(formattedDate)
        }
      }
    });
    
    return busyPeriod;
  } catch (error) {
    console.error('繁忙期チェックエラー:', error);
    return null;
  }
}

/**
 * 複数の日付が繁忙期に該当するかチェックする関数
 * 
 * @param dates チェックする日付の配列
 * @returns 繁忙期情報の配列
 */
export async function checkBusyPeriods(dates: Date[]): Promise<{date: Date, busyPeriod: SeasonalInfo | null}[]> {
  const results: {date: Date, busyPeriod: SeasonalInfo | null}[] = [];
  
  for (const date of dates) {
    const busyPeriod = await checkBusyPeriod(date);
    results.push({ date, busyPeriod });
  }
  
  return results;
}

/**
 * テキストから日付を抽出し、繁忙期をチェックする関数
 * 
 * @param text 検索対象のテキスト
 * @returns 日付と繁忙期情報の配列
 */
export async function extractDatesAndCheckBusyPeriods(text: string): Promise<{date: Date, busyPeriod: SeasonalInfo | null}[]> {
  const dates = extractDatesFromText(text);
  return await checkBusyPeriods(dates);
}

/**
 * 日付を日本語形式（YYYY年MM月DD日）に変換する関数
 * 
 * @param date 変換する日付
 * @returns 日本語形式の日付文字列
 */
export function formatDateToJapanese(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  return `${year}年${month}月${day}日`;
}

/**
 * 日付範囲を日本語形式で表示する関数
 * 
 * @param startDate 開始日
 * @param endDate 終了日
 * @returns 日本語形式の日付範囲文字列
 */
export function formatDateRangeToJapanese(startDate: Date, endDate: Date): string {
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth() + 1;
  const startDay = startDate.getDate();
  
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth() + 1;
  const endDay = endDate.getDate();
  
  if (startYear === endYear) {
    if (startMonth === endMonth) {
      return `${startYear}年${startMonth}月${startDay}日～${endDay}日`;
    } else {
      return `${startYear}年${startMonth}月${startDay}日～${endMonth}月${endDay}日`;
    }
  } else {
    return `${startYear}年${startMonth}月${startDay}日～${endYear}年${endMonth}月${endDay}日`;
  }
} 