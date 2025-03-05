import { parse, isValid, format, addDays, addMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { prisma } from './prisma';
import { isBusyPeriod } from './busy-period';

// 日付の妥当性をチェックする関数
function isValidJapaneseDate(year: number, month: number, day: number): boolean {
  // 基本的な範囲チェック
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // 月ごとの日数チェック
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;

  return true;
}

// 日本語の日付表現を解析する関数
export function parseJapaneseDate(text: string): Date | null {
  // 正規表現パターン
  const patterns = [
    // 2024年3月1日、2024/3/1、2024-3-1
    /(\d{4})[-年/](\d{1,2})[-月/](\d{1,2})/,
    // 3月1日
    /(\d{1,2})月(\d{1,2})日/,
    // 明日、明後日、来週、来月
    /(明日|明後日|来週|来月)/
  ];

  // 現在の日付
  const now = new Date();
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      // 相対的な日付の処理
      if (match[1] === '明日') {
        return addDays(now, 1);
      }
      if (match[1] === '明後日') {
        return addDays(now, 2);
      }
      if (match[1] === '来週') {
        return addDays(now, 7);
      }
      if (match[1] === '来月') {
        return addMonths(now, 1);
      }
      
      // 年が指定されている場合
      if (match.length === 4) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        
        if (!isValidJapaneseDate(year, month, day)) {
          return null;
        }

        const date = new Date(year, month - 1, day);
        return isValid(date) ? date : null;
      }
      
      // 月日のみの場合、現在の年を使用
      if (match.length === 3) {
        const year = now.getFullYear();
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        
        if (!isValidJapaneseDate(year, month, day)) {
          return null;
        }

        const date = new Date(year, month - 1, day);
        return isValid(date) ? date : null;
      }
    }
  }
  
  return null;
}

// テキストから日付を抽出する関数
export function extractDatesFromText(text: string): Date[] {
  const dates: Date[] = [];
  const words = text.split(/[\s,。、]+/);
  
  for (const word of words) {
    const date = parseJapaneseDate(word);
    if (date) {
      dates.push(date);
    }
  }
  
  return dates;
}

// 日付を日本語形式でフォーマットする関数
export function formatJapaneseDate(date: Date): string {
  return format(date, 'yyyy年M月d日(E)', { locale: ja });
}

// 現在の応答日を取得する関数
export function getCurrentResponseDate(): Date {
  return new Date();
}

// 日付が長期滞在（7日以上）かどうかを判定する関数
export function isLongTermStay(startDate: Date, endDate: Date): boolean {
  const diffTime = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 7;
}

// 日付が大型車期間かどうかを判定する関数
export async function isLargeVehicleSeason(date: Date): Promise<boolean> {
  const targetDate = new Date(date);
  
  const season = await prisma.largeVehicleSeason.findFirst({
    where: {
      year: targetDate.getFullYear(),
      startDate: {
        lte: targetDate
      },
      endDate: {
        gte: targetDate
      }
    }
  });
  
  return season !== null;
}

// 次の大型車シーズンを取得する関数
export async function getNextLargeVehicleSeason(date: Date): Promise<{ startDate: Date; endDate: Date } | null> {
  const targetDate = new Date(date);
  
  const nextSeason = await prisma.largeVehicleSeason.findFirst({
    where: {
      year: targetDate.getFullYear(),
      startDate: {
        gt: targetDate
      }
    },
    orderBy: {
      startDate: 'asc'
    }
  });
  
  return nextSeason;
}

// 料金タイプと予約可否を定義
export type ReservationStatus = {
  isLongTerm: boolean;         // 長期預かり該当
  isLargeVehicle: boolean;     // 大型車該当
  isBusyPeriod: boolean;       // 繁忙期該当
  canAcceptReservation: boolean; // 予約受付可能かどうか
  rejectionReason?: string;     // 予約受付不可の理由
};

// 予約可否と料金タイプを判定する関数
export async function determineReservationStatus(startDate: Date, endDate: Date, isLargeVehicleRequest: boolean): Promise<ReservationStatus> {
  // 長期預かり判定（7日以上）
  const isLongTerm = isLongTermStay(startDate, endDate);
  
  // 繁忙期判定（期間内に1日でも繁忙期が含まれていれば繁忙期料金）
  const currentDate = new Date(startDate);
  let hasBusyPeriod = false;
  
  while (currentDate <= endDate) {
    const busyPeriodCheck = await isBusyPeriod(currentDate);
    if (busyPeriodCheck) {
      hasBusyPeriod = true;
      break;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // 予約可否の判定
  let canAcceptReservation = true;
  let rejectionReason: string | undefined;

  if (hasBusyPeriod) {
    if (isLargeVehicleRequest) {
      canAcceptReservation = false;
      rejectionReason = '繁忙期は大型車の受け入れができません';
    } else if (isLongTerm) {
      canAcceptReservation = false;
      rejectionReason = '繁忙期は長期預かり割引プランをご利用いただけません';
    }
  }
  
  return {
    isLongTerm,
    isLargeVehicle: isLargeVehicleRequest,
    isBusyPeriod: hasBusyPeriod,
    canAcceptReservation,
    rejectionReason
  };
} 