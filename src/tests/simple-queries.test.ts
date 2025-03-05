import { analyzeInquiry, generateDateSpecificResponse } from '../lib/response-generator';
import { parseJapaneseDate, formatJapaneseDate } from '../lib/date-utils';
import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { addDays, addMonths, format } from 'date-fns';
import { ja } from 'date-fns/locale';

describe('単純なクエリのテスト', () => {
  // 動的な日付設定
  const mockDate = new Date();
  const tomorrow = addDays(mockDate, 1);
  const nextMonth = addMonths(mockDate, 1);
  
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  describe('基本的な日付解析', () => {
    const testCases = [
      {
        description: '明示的な日付',
        query: `${format(nextMonth, 'M月d日')}に予約したいです。`,
        expectedDate: format(nextMonth, 'yyyy年M月d日')
      },
      {
        description: '年を含む日付',
        query: `${format(nextMonth, 'yyyy年M月d日')}に利用予定です。`,
        expectedDate: format(nextMonth, 'yyyy年M月d日')
      },
      {
        description: '相対的な日付（明日）',
        query: '明日利用したいのですが。',
        expectedDate: format(tomorrow, 'yyyy年M月d日')
      }
    ];

    test.each(testCases)('$description', async ({ query, expectedDate }) => {
      const result = await analyzeInquiry(query);
      expect(result.dates).toHaveLength(1);
      expect(formatJapaneseDate(result.dates[0])).toContain(expectedDate);
    });
  });

  describe('基本的な応答生成', () => {
    test('通常期間の予約', async () => {
      const targetDate = nextMonth;
      const query = `${format(targetDate, 'M月d日')}に予約したいです。`;
      const result = await analyzeInquiry(query);
      const response = generateDateSpecificResponse(result);
      
      expect(response).toContain('ご予約希望日');
      expect(response).toContain(format(targetDate, 'yyyy年M月d日'));
      expect(response).not.toContain('繁忙期');
    });

    test('大型車シーズンの予約', async () => {
      // 4月-9月の期間内の日付を使用
      const targetMonth = mockDate.getMonth() < 3 || mockDate.getMonth() > 8 ? 
        new Date(mockDate.getFullYear(), 4, 5) :  // 5月5日
        mockDate;
      
      const query = `${format(targetMonth, 'M月d日')}に大型車で利用したいです。`;
      const result = await analyzeInquiry(query);
      const response = generateDateSpecificResponse(result);
      
      expect(response).toContain('料金に関する注意事項');
      expect(response).toContain('大型車料金が適用されます');
      expect(response).toContain('車両サイズ');
    });
  });

  describe('エラーケース', () => {
    test('日付が含まれていない問い合わせ', async () => {
      const query = '予約方法を教えてください。';
      const result = await analyzeInquiry(query);
      
      expect(result.dates).toHaveLength(1);
      expect(result.dates[0]).toEqual(mockDate);
    });

    test('不正な日付', async () => {
      const query = '13月32日に予約したいです。';
      const result = await analyzeInquiry(query);
      
      expect(result.dates).toHaveLength(0);
    });
  });
}); 