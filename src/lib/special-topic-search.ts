/**
 * 特定トピックの専用検索ロジックを提供するモジュール
 * 特に「外車の駐車」「予約変更」「国際線」など重要なトピックに特化
 */

import { prisma } from './db';
import { Knowledge } from '@prisma/client';
import { SearchResult } from './common-types';

/**
 * 外車駐車関連の専用検索ロジック
 */
export async function searchLuxuryCarParking(query: string): Promise<SearchResult[] | null> {
  if (!isLuxuryCarParkingQuery(query)) {
    return null;
  }

  console.log('専用トピック検索: 外車駐車関連のクエリを検出しました');

  try {
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: '外車', mode: 'insensitive' } },
          { question: { contains: '高級車', mode: 'insensitive' } },
          { question: { contains: 'レクサス', mode: 'insensitive' } },
          { question: { contains: 'BMW', mode: 'insensitive' } },
          { question: { contains: 'ベンツ', mode: 'insensitive' } },
          { question: { contains: 'アウディ', mode: 'insensitive' } },
          { answer: { contains: '外車や大型高級車', mode: 'insensitive' } }
        ],
        AND: [
          { 
            OR: [
              { question: { contains: '駐車', mode: 'insensitive' } },
              { answer: { contains: '駐車', mode: 'insensitive' } },
              { question: { contains: '停め', mode: 'insensitive' } },
              { answer: { contains: '停め', mode: 'insensitive' } }
            ]
          }
        ]
      }
    });

    if (results.length > 0) {
      console.log(`専用トピック検索: 外車駐車関連の結果が ${results.length} 件見つかりました`);
      return results.map(result => ({
        ...result,
        score: calculateLuxuryCarScore(result, query),
        note: '外車駐車専用検索で見つかりました'
      }));
    }

    console.log('専用トピック検索: 外車駐車関連の結果が見つかりませんでした');
    return null;
  } catch (error) {
    console.error('専用トピック検索エラー (外車駐車):', error);
    return null;
  }
}

/**
 * 予約変更関連の専用検索ロジック
 */
export async function searchReservationChange(query: string): Promise<SearchResult[] | null> {
  if (!isReservationChangeQuery(query)) {
    return null;
  }

  console.log('専用トピック検索: 予約変更関連のクエリを検出しました');

  try {
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: '予約変更', mode: 'insensitive' } },
          { question: { contains: '予約の変更', mode: 'insensitive' } },
          { main_category: { contains: '予約変更', mode: 'insensitive' } },
          { sub_category: { contains: '予約変更', mode: 'insensitive' } },
          {
            AND: [
              { question: { contains: '予約', mode: 'insensitive' } },
              { question: { contains: '変更', mode: 'insensitive' } }
            ]
          }
        ]
      },
      orderBy: [
        { main_category: 'asc' },
        { updatedAt: 'desc' }
      ]
    });

    if (results.length > 0) {
      console.log(`専用トピック検索: 予約変更関連の結果が ${results.length} 件見つかりました`);
      return results.map(result => ({
        ...result,
        score: calculateReservationChangeScore(result, query),
        note: '予約変更専用検索で見つかりました'
      }));
    }

    console.log('専用トピック検索: 予約変更関連の結果が見つかりませんでした');
    return null;
  } catch (error) {
    console.error('専用トピック検索エラー (予約変更):', error);
    return null;
  }
}

/**
 * 国際線関連の専用検索ロジック
 */
export async function searchInternationalFlight(query: string): Promise<SearchResult[] | null> {
  if (!isInternationalFlightQuery(query)) {
    return null;
  }

  console.log('専用トピック検索: 国際線関連のクエリを検出しました');

  try {
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          { question: { contains: '国際線', mode: 'insensitive' } },
          { question: { contains: '国際便', mode: 'insensitive' } },
          { main_category: { contains: '国際線', mode: 'insensitive' } },
          { sub_category: { contains: '国際線', mode: 'insensitive' } },
          { answer: { contains: '国際線', mode: 'insensitive' } }
        ]
      },
      orderBy: [
        { main_category: 'asc' },
        { updatedAt: 'desc' }
      ]
    });

    if (results.length > 0) {
      console.log(`専用トピック検索: 国際線関連の結果が ${results.length} 件見つかりました`);
      return results.map(result => ({
        ...result,
        score: 0.9, // 高いスコアを付与
        note: '国際線専用検索で見つかりました'
      }));
    }

    console.log('専用トピック検索: 国際線関連の結果が見つかりませんでした');
    return null;
  } catch (error) {
    console.error('専用トピック検索エラー (国際線):', error);
    return null;
  }
}

// 外車駐車関連のクエリかどうかを判定
function isLuxuryCarParkingQuery(query: string): boolean {
  const luxuryCarKeywords = ['外車', '輸入車', '高級車', 'レクサス', 'BMW', 'ベンツ', 'アウディ', '外国車'];
  const parkingKeywords = ['駐車', '停め', 'パーキング', '置ける', '停められる'];

  const hasLuxuryCar = luxuryCarKeywords.some(keyword => query.includes(keyword));
  const hasParking = parkingKeywords.some(keyword => query.includes(keyword));

  return hasLuxuryCar && hasParking;
}

// 予約変更関連のクエリかどうかを判定
function isReservationChangeQuery(query: string): boolean {
  // 明示的な予約変更キーワード
  if (query.includes('予約変更') || query.includes('予約の変更') || query.includes('予約を変更')) {
    return true;
  }

  // 予約と変更の両方を含む場合
  if (query.includes('予約') && (query.includes('変更') || query.includes('修正'))) {
    return true;
  }

  return false;
}

// 国際線関連のクエリかどうかを判定
function isInternationalFlightQuery(query: string): boolean {
  const internationalKeywords = ['国際線', '国際便', 'インターナショナル', '国際', '海外便'];
  return internationalKeywords.some(keyword => query.includes(keyword));
}

// 外車駐車関連の結果のスコア計算
function calculateLuxuryCarScore(result: Knowledge, query: string): number {
  // 完全一致の場合は最大スコア
  if (result.question && result.question.trim() === query.trim()) {
    return 1.0;
  }

  let score = 0.8; // 基本スコアは高め

  // 外車関連のキーワードを含む場合、スコアを加算
  if (
    (result.question && (result.question.includes('外車') || result.question.includes('高級車'))) ||
    (result.answer && (result.answer.includes('外車') || result.answer.includes('高級車')))
  ) {
    score += 0.1;
  }

  // 「補償の都合上」など制限に関する情報を含む場合、さらにスコアを加算
  if (
    (result.answer && result.answer.includes('補償の都合上')) ||
    (result.answer && result.answer.includes('お受けしておりません'))
  ) {
    score += 0.1;
  }

  return Math.min(1.0, score); // 最大値は1.0に制限
}

// 予約変更関連の結果のスコア計算
function calculateReservationChangeScore(result: Knowledge, query: string): number {
  // 完全一致の場合は最大スコア
  if (result.question && result.question.trim() === query.trim()) {
    return 1.0;
  }

  let score = 0.7; // 基本スコア

  // メインカテゴリが予約変更の場合
  if (result.main_category && result.main_category.includes('予約変更')) {
    score += 0.2;
  }

  // 質問に「予約変更」を含む場合
  if (result.question && result.question.includes('予約変更')) {
    score += 0.1;
  }

  return Math.min(1.0, score); // 最大値は1.0に制限
} 