/**
 * 日付検出と繁忙期チェックのためのユーティリティ関数
 */
import { prisma } from './db.js';
import { SeasonalInfo } from '@prisma/client';

/**
 * テキストから日付を抽出する関数
 * 
 * @param text 検索対象のテキスト
 * @returns 抽出された日付の配列（Date型）
 */
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  const currentYear = new Date().getFullYear();
  
  // パターン1: YYYY年MM月DD日 または YYYY/MM/DD または YYYY-MM-DD
  const fullDatePattern = /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})日?/g;
  let match;
  while ((match = fullDatePattern.exec(text)) !== null) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // JavaScriptの月は0-11
    const day = parseInt(match[3], 10);
    
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      dates.push(date);
    }
  }
  
  // パターン2: MM月DD日（年なし、現在の年と次の年を考慮）
  const monthDayPattern = /(\d{1,2})月(\d{1,2})日/g;
  while ((match = monthDayPattern.exec(text)) !== null) {
    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    
    // 現在の年で日付を作成
    const dateCurrentYear = new Date(currentYear, month, day);
    if (!isNaN(dateCurrentYear.getTime())) {
      dates.push(dateCurrentYear);
      
      // 現在の日付より過去の場合は、来年の可能性も考慮
      const now = new Date();
      if (dateCurrentYear < now) {
        const dateNextYear = new Date(currentYear + 1, month, day);
        dates.push(dateNextYear);
      }
    }
  }
  
  // パターン3: MM/DD（年なし、現在の年と次の年を考慮）
  const slashPattern = /(\d{1,2})\/(\d{1,2})(?!\d)/g;
  while ((match = slashPattern.exec(text)) !== null) {
    const month = parseInt(match[1], 10) - 1;
    const day = parseInt(match[2], 10);
    
    // 現在の年で日付を作成
    const dateCurrentYear = new Date(currentYear, month, day);
    if (!isNaN(dateCurrentYear.getTime())) {
      dates.push(dateCurrentYear);
      
      // 現在の日付より過去の場合は、来年の可能性も考慮
      const now = new Date();
      if (dateCurrentYear < now) {
        const dateNextYear = new Date(currentYear + 1, month, day);
        dates.push(dateNextYear);
      }
    }
  }
  
  // パターン4: 「来週」「来月」「今週末」などの相対的な表現
  if (text.includes('来週')) {
    const now = new Date();
    const nextWeek = new Date(now);
    nextWeek.setDate(now.getDate() + 7);
    dates.push(nextWeek);
  }
  
  if (text.includes('来月')) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);
    dates.push(nextMonth);
  }
  
  if (text.includes('今週末') || text.includes('今週の土曜') || text.includes('今週の日曜')) {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0: 日曜, 1: 月曜, ..., 6: 土曜
    
    // 土曜日までの日数を計算
    const daysUntilSaturday = dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
    const saturday = new Date(now);
    saturday.setDate(now.getDate() + daysUntilSaturday);
    dates.push(saturday);
    
    // 日曜日までの日数を計算
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const sunday = new Date(now);
    sunday.setDate(now.getDate() + daysUntilSunday);
    dates.push(sunday);
  }
  
  if (text.includes('連休') || text.includes('休日')) {
    // 次の祝日や連休を考慮（簡易版）
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);
    dates.push(nextMonth);
  }
  
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