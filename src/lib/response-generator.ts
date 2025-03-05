import { 
  extractDatesFromText, 
  getCurrentResponseDate, 
  formatJapaneseDate,
  isLongTermStay,
  determineReservationStatus
} from './date-utils';
import { isBusyPeriod, getNextBusyPeriod } from './busy-period';

interface ResponseContext {
  dates: Date[];
  isLongTerm: boolean;
  isLargeVehicle: boolean;
  isBusyPeriod: boolean;
  canAcceptReservation: boolean;
  rejectionReason?: string;
  nextBusyPeriod: { startDate: Date; endDate: Date } | null;
  responseDate: Date;
}

export async function analyzeInquiry(text: string): Promise<ResponseContext> {
  // メールテキストから日付を抽出
  const dates = extractDatesFromText(text);
  const responseDate = getCurrentResponseDate();
  
  // 日付が指定されていない場合は、質問に日付が含まれていない場合のみ応答日を使用
  const hasInvalidDate = text.match(/(\d{1,2})月(\d{1,2})日/) && dates.length === 0;
  const targetDates = dates.length > 0 ? dates : (hasInvalidDate ? [] : [responseDate]);
  
  // 大型車の要求かどうかを判定
  const isLargeVehicleRequest = text.includes('大型車') || text.includes('大型');
  
  // 予約可否と料金タイプの判定
  const reservationStatus = targetDates.length >= 2 ?
    await determineReservationStatus(targetDates[0], targetDates[targetDates.length - 1], isLargeVehicleRequest) :
    {
      isLongTerm: false,
      isLargeVehicle: isLargeVehicleRequest,
      isBusyPeriod: false,
      canAcceptReservation: true
    };
  
  // 次の繁忙期情報の取得
  const nextBusyPeriod = targetDates.length > 0 ?
    await getNextBusyPeriod(targetDates[0]) :
    await getNextBusyPeriod(responseDate);
  
  return {
    dates: targetDates,
    ...reservationStatus,
    nextBusyPeriod,
    responseDate
  };
}

export function generateDateSpecificResponse(context: ResponseContext): string {
  const parts: string[] = [];
  
  // 日付に関する情報を追加
  if (context.dates.length > 0) {
    const dateStr = context.dates
      .map(d => formatJapaneseDate(d))
      .join('から');
    parts.push(`ご予約希望日：${dateStr}`);
  }

  // 予約可否の判定結果を追加
  if (!context.canAcceptReservation && context.rejectionReason) {
    parts.push(`※ご予約をお受けできません：${context.rejectionReason}`);
    return parts.join('\n\n');
  }
  
  // 料金に関する説明
  const priceNotes: string[] = [];
  
  // 大型車の場合の注意事項（繁忙期以外）
  if (context.isLargeVehicle && !context.isBusyPeriod) {
    priceNotes.push(
      '・大型車料金が適用されます（基本料金＋追加料金）',
      '・事前に車両サイズをお知らせください',
      '・専用スペースの確保が必要です'
    );
  }
  
  // 長期滞在の場合の注意事項（繁忙期以外）
  if (context.isLongTerm && !context.isBusyPeriod) {
    priceNotes.push('・長期預かり割引が適用されます（基本料金からの割引）');
  }
  
  // 繁忙期の場合の注意事項
  if (context.isBusyPeriod) {
    priceNotes.push(
      '・繁忙期料金が適用されます',
      '・通常の料金体系とは異なります',
      '・早めのご予約をお勧めします'
    );
  }
  
  // 料金に関する注意事項をまとめて追加
  if (priceNotes.length > 0) {
    parts.push('料金に関する注意事項：\n' + priceNotes.join('\n'));
  }
  
  // 予約に関する一般的な注意事項
  const generalNotes: string[] = [];
  
  if (context.isLongTerm || context.isBusyPeriod || context.isLargeVehicle) {
    generalNotes.push('・事前予約が必要です');
    generalNotes.push('・キャンセルポリシーが適用されます');
  }
  
  if (generalNotes.length > 0) {
    parts.push('ご予約に関する注意事項：\n' + generalNotes.join('\n'));
  }
  
  // 次の繁忙期の案内
  if (context.nextBusyPeriod) {
    const startStr = formatJapaneseDate(context.nextBusyPeriod.startDate);
    const endStr = formatJapaneseDate(context.nextBusyPeriod.endDate);
    parts.push(`次回の繁忙期：${startStr}から${endStr}\n※繁忙期は大型車の受入および長期預かり割引プランのご利用ができません`);
  }
  
  return parts.join('\n\n');
} 