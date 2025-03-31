/**
 * 検索ロジックの最適化
 * 階層的な検索戦略と効果的なスコアリングシステムを実装
 */

import { Prisma } from '@prisma/client';
import { prisma } from './db';

export interface OptimizedSearchResult {
  id: number;
  main_category?: string | null;
  sub_category?: string | null;
  detail_category?: string | null;
  question?: string | null;
  answer: string;
  score: number;
  search_method: string;
  search_notes?: string;
}

/**
 * 検索文字列の前処理を行う関数
 * 日本語の特性を考慮した前処理を実施
 */
function preprocessQuery(query: string): {
  normalizedQuery: string;
  keyTerms: string[];
  pgroongaQuery: string;
  tsQuery: string;
} {
  // 元のクエリを保存
  // const originalQuery = query.trim();
  
  // 基本的な正規化（余分な空白の削除など）
  const normalizedQuery = query.trim().replace(/\s+/g, ' ').trim();
  
  // 日本語の助詞や句読点を削除して単語抽出の準備
  const cleanQuery = normalizedQuery.replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割して短すぎる単語を除外
  const words = cleanQuery.split(' ').filter(word => word.length > 1);
  
  // 重要キーワードの抽出
  const keyTerms = extractKeyTerms(words, normalizedQuery);
  
  // PGroonga用のクエリ生成
  // 例: "word1 OR word2 OR word3"
  const pgroongaQuery = keyTerms.join(' OR ');
  
  // PostgreSQL全文検索用のtsqueryフォーマット
  // 例: "word1 | word2 | word3"
  const tsQuery = keyTerms.join(' | ');
  
  return {
    // originalQuery,
    normalizedQuery,
    keyTerms,
    pgroongaQuery,
    tsQuery
  };
}

/**
 * 重要なキーワードを抽出する関数
 */
function extractKeyTerms(words: string[], fullQuery: string): string[] {
  // 日本語の一般的なストップワード
  const commonStopwords = [
    'です', 'ます', 'した', 'して', 'ください', 'お願い', 'いる', 'ある',
    'なる', 'という', 'いう', 'ため', 'ので', 'から', 'ことが', 'ことを',
    'もの', 'ように', 'よう', 'など', 'どの', 'その', 'これ', 'それ',
    'ほど', 'まで', 'より', 'でも', 'でき', 'なく', 'なり', 'なっ',
    'あり', 'あっ', 'いい', 'よい', 'いく', 'おり', 'くる', 'くれ',
    'しま', 'せる', 'たい', 'たら', 'だけ', 'つい', 'てる', 'とき',
    'どう', 'ない', 'なら', 'にて', 'のみ', 'ばか', 'へと', 'まし',
    'まま', 'みた', 'みる', 'もう', 'やっ', 'よく', 'わか'
  ];
  
  // 特に重要な単語のパターン
  const importantPatterns = [
    /予約|キャンセル|変更|料金|支払|駐車|送迎|車種|サイズ|営業|時間/,
    /オンライン|インターネット|ウェブ|スマホ|アプリ/,
    /国際線|国内線|到着|出発|帰国|出国/,
    /混雑|繁忙|ピーク|満車|空き/,
    /クレジット|カード|現金|電子|マネー/,
    /領収書|レシート|明細|証明書/,
    /割引|クーポン|ディスカウント|特典/,
    /精算|会計|決済|支払い/,
    /外車|レクサス|BMW|ベンツ|アウディ|大型車/
  ];
  
  // 特別なカテゴリの複合パターン
  const specialPatterns = [
    { pattern: /予約.*変更|変更.*予約|予約内容.*変更/, category: '予約変更' },
    { pattern: /外車.*駐車|駐車.*外車|高級車.*駐車/, category: '外車駐車' },
    { pattern: /国際線.*利用|利用.*国際線/, category: '国際線利用' },
    { pattern: /営業.*時間|時間.*営業|開店|閉店/, category: '営業時間' }
  ];
  
  // キーワード格納用の配列
  const keyTerms: string[] = [];
  
  // 特別パターンのチェック（最優先）
  for (const { pattern, category } of specialPatterns) {
    if (pattern.test(fullQuery)) {
      keyTerms.push(category);
    }
  }
  
  // 単語ごとの処理
  for (const word of words) {
    // ストップワードはスキップ
    if (commonStopwords.includes(word)) continue;
    
    // 数字のみの単語はスキップ（日付を除く）
    if (/^\d+$/.test(word) && !/\d+[月日時分]|\d+:\d+/.test(word)) continue;
    
    // 重要なパターンにマッチする単語は優先
    if (importantPatterns.some(pattern => pattern.test(word))) {
      // 既に追加されていなければ追加
      if (!keyTerms.includes(word)) {
        keyTerms.push(word);
      }
    } else {
      // 通常の単語は最後に追加
      if (!keyTerms.includes(word)) {
        keyTerms.push(word);
      }
    }
  }
  
  // 特定の重要キーワードがクエリ全体に含まれている場合に追加
  if (fullQuery.includes('外車') || fullQuery.includes('レクサス') ||
      fullQuery.includes('BMW') || fullQuery.includes('ベンツ')) {
    if (!keyTerms.includes('外車')) {
      keyTerms.push('外車');
    }
    if (!keyTerms.includes('高級車')) {
      keyTerms.push('高級車');
    }
  }
  
  if (fullQuery.includes('予約') && fullQuery.includes('変更')) {
    if (!keyTerms.includes('予約変更')) {
      keyTerms.push('予約変更');
    }
  }
  
  if (fullQuery.includes('国際線')) {
    if (!keyTerms.includes('国際線')) {
      keyTerms.push('国際線');
    }
  }
  
  return keyTerms;
}

/**
 * 最適化された検索関数
 * 階層的な検索戦略を実装
 */
export async function optimizedSearch(query: string): Promise<OptimizedSearchResult[]> {
  console.log(`検索クエリ: "${query}"`);
  
  // クエリが空の場合は空の結果を返す
  if (!query.trim()) {
    return [];
  }
  
  // 検索クエリの前処理
  const { 
    normalizedQuery, 
    keyTerms, 
    pgroongaQuery, 
    tsQuery 
  } = preprocessQuery(query);
  
  console.log('前処理済みクエリ情報:');
  console.log(`- 正規化クエリ: "${normalizedQuery}"`);
  console.log(`- キーワード: [${keyTerms.join(', ')}]`);
  console.log(`- PGroongaクエリ: "${pgroongaQuery}"`);
  console.log(`- TSクエリ: "${tsQuery}"`);
  
  // 階層的検索戦略
  let results: OptimizedSearchResult[] = [];
  
  // 段階1: 特別なトピック検索（最も優先度の高い専用検索）
  if (
    normalizedQuery.includes('外車') || 
    normalizedQuery.includes('レクサス') || 
    normalizedQuery.includes('BMW') || 
    normalizedQuery.includes('ベンツ')
  ) {
    console.log('外車関連の専用検索を実行中...');
    const luxuryCarResults = await searchLuxuryCars();
    if (luxuryCarResults.length > 0) {
      console.log(`外車関連の検索で ${luxuryCarResults.length} 件のナレッジが見つかりました`);
      return luxuryCarResults;
    }
  }
  
  if (
    normalizedQuery.includes('予約') && 
    normalizedQuery.includes('変更')
  ) {
    console.log('予約変更の専用検索を実行中...');
    const reservationChangeResults = await searchReservationChange();
    if (reservationChangeResults.length > 0) {
      console.log(`予約変更の検索で ${reservationChangeResults.length} 件のナレッジが見つかりました`);
      return reservationChangeResults;
    }
  }
  
  if (
    normalizedQuery.includes('国際線') || 
    (normalizedQuery.includes('国際') && normalizedQuery.includes('線'))
  ) {
    console.log('国際線関連の専用検索を実行中...');
    const internationalResults = await searchInternationalFlight();
    if (internationalResults.length > 0) {
      console.log(`国際線関連の検索で ${internationalResults.length} 件のナレッジが見つかりました`);
      return internationalResults;
    }
  }
  
  // 段階2: PGroongaを使用した高精度検索（メイン検索）<- コメントアウト
  /*
  try {
    console.log('PGroonga高精度検索を実行中...');
    
    results = await prisma.$queryRaw<OptimizedSearchResult[]>`
      SELECT 
        k.id,
        k.main_category,
        k.sub_category,
        k.detail_category,
        k.question,
        k.answer,
        pgroonga_score(k.tableoid, k.ctid) AS score,
        'pgroonga_main' AS search_method
      FROM "Knowledge" k
      WHERE 
        k.search_vector &@* ${pgroongaQuery}
      ORDER BY
        score DESC
      LIMIT 10
    `;
    
    console.log(`PGroonga検索で ${results.length} 件のナレッジが見つかりました`);
    
    if (results.length > 0) {
      return processSearchResults(results);
    }
  } catch (error) {
    console.error('PGroonga検索でエラーが発生しました:', error);
  }
  */
  
  // 段階2 (変更): PostgreSQL全文検索（メイン検索として使用）
  try {
    console.log('PostgreSQL全文検索を実行中...');
    
    results = await prisma.$queryRaw<OptimizedSearchResult[]>`
      SELECT 
        k.id,
        k.main_category,
        k.sub_category,
        k.detail_category,
        k.question,
        k.answer,
        ts_rank(k.search_vector, to_tsquery('japanese', ${tsQuery})) AS score,
        'ts_query' AS search_method
      FROM "Knowledge" k
      WHERE 
        k.search_vector @@ to_tsquery('japanese', ${tsQuery})
      ORDER BY
        score DESC
      LIMIT 10
    `;
    
    console.log(`全文検索で ${results.length} 件のナレッジが見つかりました`);
    
    if (results.length > 0) {
      // PostgreSQL FTSで見つかった場合は、ここで結果を返す
      return processSearchResults(results); 
    }
  } catch (error) {
    console.error('全文検索でエラーが発生しました:', error);
  }
  
  // 段階3 (変更): カテゴリとキーワードの組み合わせ検索 (フォールバック1)
  try {
    console.log('カテゴリとキーワードの組み合わせ検索を実行中...');
    
    // 特定のカテゴリに関連するキーワードのマッピング
    const categoryMappings = [
      { keywords: ['予約', '申込', 'リザーブ'], category: '予約' },
      { keywords: ['変更', '修正', '更新'], category: '変更' },
      { keywords: ['キャンセル', '解約', '取り消し'], category: '解約' },
      { keywords: ['料金', '価格', '費用', '支払'], category: '料金' },
      { keywords: ['駐車', 'パーキング'], category: '駐車場' },
      { keywords: ['営業時間', '営業', '開店', '閉店'], category: '営業時間' }
    ];
    
    // キーワードからカテゴリを推測
    const relevantCategories = categoryMappings
      .filter(mapping => mapping.keywords.some(kw => keyTerms.includes(kw)))
      .map(mapping => mapping.category);
    
    if (relevantCategories.length > 0) {
      console.log(`関連カテゴリ: [${relevantCategories.join(', ')}]`);
      
      results = await prisma.$queryRaw<OptimizedSearchResult[]>`
        SELECT 
          k.id,
          k.main_category,
          k.sub_category,
          k.detail_category,
          k.question,
          k.answer,
          0.8 AS score,
          'category_search' AS search_method
        FROM "Knowledge" k
        WHERE 
          k.main_category IN (${Prisma.join(relevantCategories)})
          OR k.sub_category IN (${Prisma.join(relevantCategories)})
        ORDER BY
          k.id DESC
        LIMIT 10
      `;
      
      console.log(`カテゴリ検索で ${results.length} 件のナレッジが見つかりました`);
      
      if (results.length > 0) {
        return processSearchResults(results);
      }
    }
  } catch (error) {
    console.error('カテゴリ検索でエラーが発生しました:', error);
  }
  
  // 段階4 (変更): 部分一致検索（最終手段 - フォールバック2）
  try {
    console.log('部分一致検索を実行中...');
    
    // 各キーワードに対して部分一致検索を実行
    const orConditions = [];
    
    // 各キーワードでOR条件を作成
    for (const term of keyTerms.slice(0, 3)) { // 先頭3つのみ使用（パフォーマンス対策）
      orConditions.push(
        Prisma.sql`k.question ILIKE ${'%' + term + '%'}`,
        Prisma.sql`k.answer ILIKE ${'%' + term + '%'}`
      );
    }
    
    if (orConditions.length > 0) {
      const whereClause = Prisma.sql`(${Prisma.join(orConditions, ' OR ')})`;
      
      results = await prisma.$queryRaw<OptimizedSearchResult[]>`
        SELECT 
          k.id,
          k.main_category,
          k.sub_category,
          k.detail_category,
          k.question,
          k.answer,
          0.5 AS score,
          'partial_match' AS search_method
        FROM "Knowledge" k
        WHERE ${whereClause}
        ORDER BY
          k.id DESC
        LIMIT 10
      `;
      
      console.log(`部分一致検索で ${results.length} 件のナレッジが見つかりました`);
      
      if (results.length > 0) {
        return processSearchResults(results);
      }
    }
  } catch (error) {
    console.error('部分一致検索でエラーが発生しました:', error);
  }
  
  // 何も見つからなかった場合は空の配列を返す
  console.log('検索結果が見つかりませんでした');
  return [];
}

/**
 * 外車に関する専用検索関数
 */
async function searchLuxuryCars(): Promise<OptimizedSearchResult[]> {
  try {
    const results = await prisma.$queryRaw<OptimizedSearchResult[]>`
      SELECT 
        k.id,
        k.main_category,
        k.sub_category,
        k.detail_category,
        k.question,
        k.answer,
        1.0 AS score,
        'luxury_car_search' AS search_method
      FROM "Knowledge" k
      WHERE 
        (k.question ILIKE '%外車%' OR k.answer ILIKE '%外車%')
        OR (k.question ILIKE '%高級車%' OR k.answer ILIKE '%高級車%')
        OR (k.question ILIKE '%大型車%' OR k.answer ILIKE '%大型車%')
        OR (k.main_category ILIKE '%車種%' OR k.sub_category ILIKE '%車種%')
      ORDER BY
        k.id DESC
      LIMIT 5
    `;
    
    return results.map(r => ({
      ...r,
      search_notes: '外車や高級車に関する情報です'
    }));
  } catch (error) {
    console.error('外車専用検索でエラーが発生しました:', error);
    return [];
  }
}

/**
 * 予約変更に関する専用検索関数
 */
async function searchReservationChange(): Promise<OptimizedSearchResult[]> {
  try {
    const results = await prisma.$queryRaw<OptimizedSearchResult[]>`
      SELECT 
        k.id,
        k.main_category,
        k.sub_category,
        k.detail_category,
        k.question,
        k.answer,
        1.0 AS score,
        'reservation_change_search' AS search_method
      FROM "Knowledge" k
      WHERE 
        (k.question ILIKE '%予約%' AND k.question ILIKE '%変更%')
        OR (k.answer ILIKE '%予約%' AND k.answer ILIKE '%変更%')
        OR (k.main_category = '予約' AND k.sub_category = '変更')
      ORDER BY
        k.id DESC
      LIMIT 5
    `;
    
    return results.map(r => ({
      ...r,
      search_notes: '予約の変更に関する情報です'
    }));
  } catch (error) {
    console.error('予約変更専用検索でエラーが発生しました:', error);
    return [];
  }
}

/**
 * 国際線に関する専用検索関数
 */
async function searchInternationalFlight(): Promise<OptimizedSearchResult[]> {
  try {
    const results = await prisma.$queryRaw<OptimizedSearchResult[]>`
      SELECT 
        k.id,
        k.main_category,
        k.sub_category,
        k.detail_category,
        k.question,
        k.answer,
        1.0 AS score,
        'international_flight_search' AS search_method
      FROM "Knowledge" k
      WHERE 
        k.question ILIKE '%国際線%'
        OR k.answer ILIKE '%国際線%'
        OR k.main_category ILIKE '%国際%'
        OR k.sub_category ILIKE '%国際%'
      ORDER BY
        k.id DESC
      LIMIT 5
    `;
    
    return results.map(r => ({
      ...r,
      search_notes: '国際線に関する情報です'
    }));
  } catch (error) {
    console.error('国際線専用検索でエラーが発生しました:', error);
    return [];
  }
}

/**
 * 検索結果を処理して追加情報を付与する関数
 */
function processSearchResults(
  results: OptimizedSearchResult[]
): OptimizedSearchResult[] {
  return results.map(result => {
    // 検索結果に説明を追加
    let searchNote = '';
    
    // 検索方法に基づいて説明を設定
    switch (result.search_method) {
      case 'pgroonga_main':
        searchNote = '高精度検索で見つかりました';
        break;
      case 'ts_query':
        searchNote = '全文検索で見つかりました';
        break;
      case 'category_search':
        searchNote = 'カテゴリ検索で見つかりました';
        break;
      case 'partial_match':
        searchNote = '部分一致検索で見つかりました';
        break;
      case 'luxury_car_search':
        searchNote = '外車に関する専用検索で見つかりました';
        break;
      case 'reservation_change_search':
        searchNote = '予約変更に関する専用検索で見つかりました';
        break;
      case 'international_flight_search':
        searchNote = '国際線に関する専用検索で見つかりました';
        break;
      default:
        searchNote = '検索で見つかりました';
    }
    
    // カテゴリ情報を追加
    if (result.main_category) {
      const category = [
        result.main_category,
        result.sub_category,
        result.detail_category
      ].filter(Boolean).join(' > ');
      
      searchNote += `（カテゴリ: ${category}）`;
    }
    
    return {
      ...result,
      search_notes: searchNote
    };
  });
} 