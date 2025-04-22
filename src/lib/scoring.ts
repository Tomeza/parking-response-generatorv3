/**
 * 検索結果のスコアリングを改善するモジュール
 * PGroongaスコア、類似度スコア、カテゴリスコアを組み合わせて
 * より関連性の高い結果を上位に表示する
 */

import { Knowledge } from '@prisma/client';
import { SearchResult } from './common-types';

/**
 * 検索結果の複合スコアを計算する関数
 */
export function calculateScore(result: SearchResult, query: string): number {
  // 各スコアを実効値に変換（0または未定義の場合は小さな値を代入）
  const pgrScore = result.pgroonga_score || 0.01; 
  const questionSim = result.question_sim || 0;
  const answerSim = result.answer_sim || 0;
  
  // 完全一致の場合は最大スコア
  if (result.question && result.question.trim() === query.trim()) {
    return 1.0;
  }
  
  // カテゴリによるボーナススコア
  const categoryBonus = calculateCategoryBonus(result, query);
  
  // 特定トピックのボーナススコア
  const topicBonus = calculateTopicBonus(result, query);
  
  // 最終スコアの計算（重み付け）
  // 質問の類似度を最も重視、次に回答の類似度、最後にPGroongaスコア
  const weightedScore = 
    (questionSim * 0.65) + 
    (answerSim * 0.25) + 
    (pgrScore * 0.1) + 
    categoryBonus + 
    topicBonus;
  
  // 0〜1の範囲に正規化
  return Math.min(1.0, weightedScore);
}

/**
 * カテゴリに基づくボーナススコアを計算
 */
function calculateCategoryBonus(result: Knowledge, query: string): number {
  let bonus = 0;
  
  // メインカテゴリの一致
  if (result.main_category) {
    if (
      (query.includes('予約') && result.main_category.includes('予約')) ||
      (query.includes('営業') && result.main_category.includes('営業')) ||
      (query.includes('料金') && result.main_category.includes('料金')) ||
      (query.includes('キャンセル') && result.main_category.includes('キャンセル')) ||
      (query.includes('外車') && result.main_category.includes('利用制限'))
    ) {
      bonus += 0.2;
    }
  }
  
  // サブカテゴリの一致
  if (result.sub_category) {
    if (
      (query.includes('予約変更') && result.sub_category.includes('予約変更')) ||
      (query.includes('キャンセル') && result.sub_category.includes('キャンセル')) ||
      (query.includes('営業時間') && result.sub_category.includes('営業時間')) ||
      (query.includes('外車') && result.sub_category.includes('車両制限'))
    ) {
      bonus += 0.1;
    }
  }
  
  return bonus;
}

/**
 * 特定のトピックに対するボーナススコアを計算
 */
function calculateTopicBonus(result: Knowledge, query: string): number {
  let bonus = 0;
  
  // 外車駐車の特別ケース
  if (isLuxuryCarParkingQuery(query) && isLuxuryCarParkingResult(result)) {
    bonus += 0.4;
  }
  
  // 国際線の特別ケース
  if (isInternationalFlightQuery(query) && isInternationalFlightResult(result)) {
    bonus += 0.3;
  }
  
  // 予約変更の特別ケース
  if (isReservationChangeQuery(query) && isReservationChangeResult(result)) {
    bonus += 0.35;
  }
  
  return bonus;
}

/**
 * 検索結果に特別な注釈を追加する関数
 */
export function addSearchNotes(results: SearchResult[], query: string): SearchResult[] {
  return results.map(result => {
    // 既に注釈がある場合はそのまま
    if (result.note) {
      return result;
    }
    
    // 特定のトピックに対する注釈
    if (isLuxuryCarParkingQuery(query) && isLuxuryCarParkingResult(result)) {
      return { ...result, note: '外車駐車に関する情報です' };
    }
    
    if (isInternationalFlightQuery(query) && isInternationalFlightResult(result)) {
      return { ...result, note: '国際線に関する情報です' };
    }
    
    if (isReservationChangeQuery(query) && isReservationChangeResult(result)) {
      return { ...result, note: '予約変更に関する情報です' };
    }
    
    // デフォルトの注釈
    return { ...result, note: '検索結果' };
  });
}

// 外車駐車関連のクエリかどうかを判定
function isLuxuryCarParkingQuery(query: string): boolean {
  const luxuryCarKeywords = ['外車', '輸入車', '高級車', 'レクサス', 'BMW', 'ベンツ', 'アウディ', '外国車'];
  const parkingKeywords = ['駐車', '停め', 'パーキング', '置ける', '停められる'];

  const hasLuxuryCar = luxuryCarKeywords.some(keyword => query.includes(keyword));
  const hasParking = parkingKeywords.some(keyword => query.includes(keyword));

  return hasLuxuryCar && hasParking;
}

// 外車駐車関連の結果かどうかを判定
function isLuxuryCarParkingResult(result: Knowledge): boolean {
  const hasLuxuryCar = 
    (result.question && (
      result.question.includes('外車') || 
      result.question.includes('高級車') ||
      result.question.includes('レクサス') ||
      result.question.includes('BMW') ||
      result.question.includes('ベンツ')
    )) || 
    (result.answer && (
      result.answer.includes('外車') || 
      result.answer.includes('高級車') ||
      result.answer.includes('大型高級車')
    ));
    
  const hasParking = 
    (result.question && result.question.includes('駐車')) || 
    (result.answer && result.answer.includes('駐車'));
    
  return Boolean(hasLuxuryCar && hasParking);
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

// 予約変更関連の結果かどうかを判定
function isReservationChangeResult(result: Knowledge): boolean {
  // 明示的な予約変更の言及
  if (
    (result.question && (
      result.question.includes('予約変更') || 
      result.question.includes('予約の変更')
    )) || 
    ((result.main_category && result.main_category.includes('予約')) &&
     (result.sub_category && result.sub_category.includes('変更')))
  ) {
    return true;
  }
  
  // 予約と変更の両方を含む
  if (
    (result.question && result.question.includes('予約') && result.question.includes('変更')) ||
    (result.answer && result.answer.includes('予約') && result.answer.includes('変更'))
  ) {
    return true;
  }
  
  return false;
}

// 国際線関連のクエリかどうかを判定
function isInternationalFlightQuery(query: string): boolean {
  const internationalKeywords = ['国際線', '国際便', 'インターナショナル', '国際', '海外便'];
  return internationalKeywords.some(keyword => query.includes(keyword));
}

// 国際線関連の結果かどうかを判定
function isInternationalFlightResult(result: Knowledge): boolean {
  return Boolean(
    (result.question && (
      result.question.includes('国際線') || 
      result.question.includes('国際便')
    )) || 
    (result.answer && (
      result.answer.includes('国際線') || 
      result.answer.includes('国際便')
    )) ||
    (result.main_category && result.main_category.includes('国際線')) ||
    (result.sub_category && result.sub_category.includes('国際線'))
  );
} 