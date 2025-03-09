import { prisma } from './prisma';
import { Knowledge, SeasonalInfo } from '@prisma/client';
import { extractDatesFromText, checkBusyPeriods, formatDateToJapanese } from './date-utils';
import { searchKnowledgeByTags } from './tag-search';

/**
 * 日本語検索クエリの前処理を行う関数
 * 
 * @param query 検索クエリ
 * @returns 前処理済みの検索クエリ
 */
function preprocessJapaneseQuery(query: string): { 
  cleanedQuery: string; 
  orQuery: string | null;
  webSearchQuery: string;
  keyTerms: string[];
  andQuery: string | null;
  plainQuery: string | null;
  specialTerms: string[];
} {
  // ステップ1: 入力の正規化
  const normalized = query.trim().replace(/\s+/g, ' ');
  
  // 空のクエリや特殊文字のみの場合のエラー処理
  if (!normalized) {
    return { 
      cleanedQuery: '', 
      orQuery: null,
      webSearchQuery: '',
      keyTerms: [],
      andQuery: null,
      plainQuery: null,
      specialTerms: []
    };
  }
  
  // ステップ2: 重要な用語を抽出
  const keyTerms = extractKeyTerms(normalized);
  
  // ステップ3: 特別な重要キーワードを検出
  const specialTerms = extractSpecialTerms(normalized);
  
  // ステップ4: 空白区切りのクエリをOR演算子で結合
  let orQuery = null;
  let andQuery = null;
  let plainQuery = null;
  
  if (normalized.includes(' ')) {
    const terms = normalized.split(' ').filter(term => term.length > 0);
    
    // OR検索用クエリ
    orQuery = terms.map(k => `${k}:*`).join(' | ');
    
    // AND検索用クエリ
    andQuery = terms.map(k => `${k}:*`).join(' & ');
    
    // プレーンテキスト検索用クエリ
    plainQuery = terms.join(' & ');
  } else {
    // 単一単語の場合
    plainQuery = normalized;
  }
  
  // ステップ5: websearch_to_tsquery用のクエリを作成
  // 空白はそのまま保持して、websearch_to_tsqueryの構文に合わせる
  const webSearchQuery = normalized;
  
  return { 
    cleanedQuery: normalized, 
    orQuery,
    webSearchQuery,
    keyTerms,
    andQuery,
    plainQuery,
    specialTerms
  };
}

/**
 * 重要な用語を抽出する関数
 * 日本語テキスト処理を強化
 */
function extractKeyTerms(text: string): string[] {
  // 日本語の一般的なストップワード
  const commonStopwords = [
    'です', 'ます', 'した', 'して', 'ください', 'お願い', 'いる', 'ある', 'れる', 'られる', 
    'なる', 'という', 'いう', 'ため', 'ので', 'から', 'ことが', 'ことを', 'ことは', 'こと', 
    'もの', 'ように', 'よう', 'など', 'どの', 'その', 'これ', 'それ', 'あれ', 'どれ',
    'ほど', 'まで', 'より', 'でも', 'でき', 'なく', 'なり', 'なっ', 'あり', 'あっ', 'いい',
    'よい', 'いく', 'おり', 'くる', 'くれ', 'しま', 'せる', 'たい', 'たら', 'だけ', 'つい',
    'てる', 'とき', 'どう', 'ない', 'なら', 'にて', 'のみ', 'ばか', 'へと', 'まし', 'まま',
    'みた', 'みる', 'もう', 'やっ', 'よく', 'わか'
  ];
  
  // 文字列を分割（句読点、空白などで区切る）
  const segments = text.split(/[\s,、。．！？!?.]+/).filter(Boolean);
  
  // 重要な用語を抽出
  const terms = segments
    // 2文字以上の単語を抽出
    .filter(term => term.length >= 2)
    // ストップワードを除外
    .filter(term => !commonStopwords.includes(term))
    // 数字のみの単語を除外（ただし日付や時間の可能性があるものは保持）
    .filter(term => !/^\d+$/.test(term) || /\d+[月日時分]|\d+:\d+/.test(term))
    // 上位15語に制限（以前より増やす）
    .slice(0, 15);
  
  // 追加: 複合語の処理
  // 連続する2つの単語を結合して複合語として追加
  if (segments.length >= 2) {
    for (let i = 0; i < segments.length - 1; i++) {
      const compound = segments[i] + segments[i + 1];
      if (compound.length >= 3 && compound.length <= 10) {
        terms.push(compound);
      }
    }
  }
  
  return terms;
}

/**
 * 特別な重要キーワードを抽出する関数
 * 「オンライン」「駐車場」などの特定の重要単語を検出
 */
function extractSpecialTerms(text: string): string[] {
  const specialKeywords = [
    'オンライン', '駐車場', '予約', 'キャンセル', '料金', '支払い', '送迎', '車種', 'サイズ',
    '国際線', 'インターナショナル', '朝帰国', 'レクサス', '外車', 'BMW', 'ベンツ', 'アウディ',
    '満車', '空き', '定員', '人数', '繁忙期', '混雑', 'ピーク'
  ];
  
  const foundTerms: string[] = [];
  
  // 特別キーワードの検出
  specialKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      foundTerms.push(keyword);
    }
  });
  
  // 日付パターンの検出
  const datePatterns = [
    /\d+月\d+日/,
    /\d+\/\d+/,
    /\d+\-\d+/,
    /\d+年\d+月/
  ];
  
  datePatterns.forEach(pattern => {
    const match = text.match(pattern);
    if (match) {
      foundTerms.push(match[0]);
    }
  });
  
  return foundTerms;
}

/**
 * カテゴリ情報を活用して検索を強化する関数
 */
function boostWithCategories(terms: string[]): string[] {
  const boostedTerms = [...terms];
  
  // 予約に関する単語があれば「予約」カテゴリを追加
  if (terms.some(term => /予約|申込|申し込み|キャンセル/.test(term))) {
    boostedTerms.push('予約');
  }
  
  // 料金に関する単語があれば「料金」カテゴリを追加
  if (terms.some(term => /料金|価格|費用|支払い|決済/.test(term))) {
    boostedTerms.push('料金');
  }
  
  // 駐車場に関する単語があれば「駐車場」カテゴリを追加
  if (terms.some(term => /駐車|車|パーキング/.test(term))) {
    boostedTerms.push('駐車場');
  }
  
  return boostedTerms;
}

export async function searchKnowledge(query: string): Promise<(Knowledge & { relevance: number })[] | null> {
  try {
    console.log('Searching for query:', query);
    // エンコーディング情報をログに出力
    console.log('クエリのエンコーディング情報:');
    console.log('- Buffer (hex):', Buffer.from(query).toString('hex'));
    console.log('- UTF-8 コードポイント:', [...query].map(c => c.codePointAt(0)?.toString(16)).join(' '));

    // データベース接続を確認
    console.log('データベース接続を確認');
    try {
      const count = await prisma.knowledge.count();
      console.log('データベース内のレコード数:', count);
    } catch (error) {
      console.error('データベース接続エラー:', error);
      throw error;
    }

    // 検索クエリの前処理
    const { cleanedQuery, orQuery, webSearchQuery, keyTerms, andQuery, plainQuery, specialTerms } = preprocessJapaneseQuery(query);
    if (!cleanedQuery) {
      console.log('空のクエリが指定されました');
      return null;
    }
    
    // 前処理されたクエリ情報をログに出力
    console.log('前処理されたクエリ情報:');
    console.log('- cleanedQuery:', cleanedQuery);
    console.log('- orQuery:', orQuery);
    console.log('- webSearchQuery:', webSearchQuery);
    console.log('- andQuery:', andQuery);
    console.log('- plainQuery:', plainQuery);
    console.log('- specialTerms:', specialTerms);
    
    // カテゴリ情報を活用して検索を強化
    const boostedTerms = boostWithCategories(keyTerms);
    console.log('抽出されたキーワード:', keyTerms);
    console.log('強化されたキーワード:', boostedTerms);
    
    // 日付検出と繁忙期チェック
    const dates = extractDatesFromText(query);
    console.log('検出された日付:', dates.map(d => formatDateToJapanese(d)));
    
    let busyPeriodResults: { date: Date, busyPeriod: SeasonalInfo | null }[] = [];
    if (dates.length > 0) {
      busyPeriodResults = await checkBusyPeriods(dates);
      console.log('繁忙期チェック結果:', busyPeriodResults);
    }
    
    // 繁忙期に該当する日付があるかチェック
    const hasBusyPeriod = busyPeriodResults.some(result => result.busyPeriod !== null);
    
    // 検索パターンの作成（ILIKE用）
    const searchPattern = `%${cleanedQuery}%`;
    
    // 結果を格納する配列
    let allResults: (Knowledge & { 
      rank?: number, 
      ts_score?: number,
      sim_score?: number,
      final_score?: number,
      relevance?: number
    })[] = [];
    
    // 方法0: タグベース検索（新機能）
    console.log('方法0: タグベース検索');
    const tagResults = await searchKnowledgeByTags(query);
    console.log('タグベース検索の結果:', tagResults);
    
    // タグ検索結果をマージ
    tagResults.forEach(result => {
      allResults.push({
        ...result,
        ts_score: 0,
        sim_score: result.relevance * 0.9, // タグ検索には高いスコア
        final_score: result.relevance * 0.9 * 0.3 // 類似度のみの場合
      });
    });
    
    // 方法1: Prismaのクエリビルダーを使用
    console.log('方法1: Prismaのクエリビルダーを使用');
    const results1 = await prisma.knowledge.findMany({
      where: {
        OR: [
          {
            question: {
              contains: cleanedQuery,
              mode: 'insensitive'
            }
          },
          {
            answer: {
              contains: cleanedQuery,
              mode: 'insensitive'
            }
          },
          {
            main_category: {
              contains: cleanedQuery,
              mode: 'insensitive'
            }
          },
          {
            sub_category: {
              contains: cleanedQuery,
              mode: 'insensitive'
            }
          },
          {
            detail_category: {
              contains: cleanedQuery,
              mode: 'insensitive'
            }
          }
        ]
      }
    });
    console.log('方法1の結果:', results1);
    
    // 結果をマージ
    results1.forEach(result => {
      const existingIndex = allResults.findIndex(r => r.id === result.id);
      if (existingIndex >= 0) {
        // 既存のエントリを更新（より高いスコアがあれば）
        if (0.7 > (allResults[existingIndex].sim_score || 0)) {
          allResults[existingIndex].sim_score = 0.7;
          allResults[existingIndex].final_score = 
            (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
            0.7 * 0.3; // 類似度に30%のウェイト
        }
      } else {
        // 新規エントリの追加
        allResults.push({
          ...result,
          ts_score: 0,
          sim_score: 0.7, // Prismaクエリビルダーの結果に中程度のスコア
          final_score: 0.7 * 0.3 // 類似度のみの場合
        });
      }
    });

    // 方法1.5: カテゴリの完全一致チェック（早期フォールバック）
    if (allResults.length === 0) {
      console.log('カテゴリの完全一致チェック');
      const categoryResults = await prisma.knowledge.findMany({
        where: {
          OR: [
            { main_category: cleanedQuery },
            { sub_category: cleanedQuery },
            { detail_category: cleanedQuery }
          ]
        }
      });
      console.log('カテゴリ完全一致の結果:', categoryResults);
      
      // 結果をマージ
      categoryResults.forEach(result => {
        allResults.push({
          ...result,
          ts_score: 0,
          sim_score: 0.8, // カテゴリ完全一致には高いスコア
          final_score: 0.8
        });
      });
    }

    // 方法1.6: ILIKE検索を早期に実行（フォールバック）
    if (allResults.length === 0) {
      console.log('方法1.6: ILIKEを使用した早期フォールバック検索');
      const ilikeResults = await prisma.$queryRaw<Knowledge[]>`
        SELECT 
          id,
          main_category,
          sub_category,
          detail_category,
          question,
          answer,
          is_template,
          usage,
          note,
          issue,
          "createdAt",
          "updatedAt"
        FROM "Knowledge" 
        WHERE question ILIKE ${searchPattern} 
        OR answer ILIKE ${searchPattern}
        OR main_category ILIKE ${searchPattern}
        OR sub_category ILIKE ${searchPattern}
        ORDER BY 
          CASE 
            WHEN main_category ILIKE ${searchPattern} THEN 1
            WHEN sub_category ILIKE ${searchPattern} THEN 2
            WHEN question ILIKE ${searchPattern} THEN 3
            WHEN answer ILIKE ${searchPattern} THEN 4
            ELSE 5
          END
      `;
      console.log('早期ILIKE検索の結果:', ilikeResults);
      
      // 結果をマージ
      ilikeResults.forEach(result => {
        allResults.push({
          ...result,
          ts_score: 0,
          sim_score: 0.6, // ILIKEの結果は中程度のスコア
          final_score: 0.6 * 0.3 // 類似度のみの場合
        });
      });
    }

    // 方法2: 全文検索を使用した生のSQLクエリ
    console.log('方法2: 全文検索を使用した生のSQLクエリ');
    let results2: (Knowledge & { rank: number })[] = [];
    
    try {
      // ステップ1: websearch_to_tsqueryを使用（最も柔軟な検索）
      console.log(`websearch_to_tsqueryを使用: "${webSearchQuery}"`);
      try {
        results2 = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
          SELECT 
            id,
            main_category,
            sub_category,
            detail_category,
            question,
            answer,
            is_template,
            usage,
            note,
            issue,
            "createdAt",
            "updatedAt",
            ts_rank(search_vector, websearch_to_tsquery('japanese', ${webSearchQuery})) as rank
          FROM "Knowledge" 
          WHERE search_vector @@ websearch_to_tsquery('japanese', ${webSearchQuery})
          ORDER BY rank DESC
        `;
        console.log('websearch_to_tsqueryの結果:', results2);
      } catch (error) {
        console.error('websearch_to_tsqueryエラー:', error);
        // エラーが発生しても処理を続行
      }
      
      // 結果をマージ
      results2.forEach(result => {
        const existingIndex = allResults.findIndex(r => r.id === result.id);
        if (existingIndex >= 0) {
          // 既存のエントリを更新
          allResults[existingIndex].ts_score = parseFloat(result.rank.toFixed(2));
          allResults[existingIndex].final_score = 
            (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
            (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
        } else {
          // 新規エントリの追加
          allResults.push({
            ...result,
            ts_score: parseFloat(result.rank.toFixed(2)),
            sim_score: 0,
            final_score: parseFloat(result.rank.toFixed(2)) * 0.7 // 全文検索のみの場合
          });
        }
      });
      
      // ステップ2: 複合キーワードの場合、AND検索を試みる
      if (results2.length === 0 && andQuery) {
        console.log(`複合キーワードをAND検索: "${andQuery}"`);
        try {
          const andResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
            SELECT 
              id,
              main_category,
              sub_category,
              detail_category,
              question,
              answer,
              is_template,
              usage,
              note,
              issue,
              "createdAt",
              "updatedAt",
              ts_rank(search_vector, to_tsquery('japanese', ${andQuery})) as rank
            FROM "Knowledge" 
            WHERE search_vector @@ to_tsquery('japanese', ${andQuery})
            ORDER BY rank DESC
          `;
          console.log('AND検索の結果:', andResults);
          
          // 結果をマージ
          andResults.forEach(result => {
            const existingIndex = allResults.findIndex(r => r.id === result.id);
            if (existingIndex >= 0) {
              // 既存のエントリを更新（より高いスコアがあれば更新）
              if ((result.rank || 0) > (allResults[existingIndex].ts_score || 0)) {
                allResults[existingIndex].ts_score = parseFloat(result.rank.toFixed(2));
                allResults[existingIndex].final_score = 
                  (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
                  (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
              }
            } else {
              // 新規エントリの追加
              allResults.push({
                ...result,
                ts_score: parseFloat(result.rank.toFixed(2)),
                sim_score: 0,
                final_score: parseFloat(result.rank.toFixed(2)) * 0.7 // 全文検索のみの場合
              });
            }
          });
        } catch (error) {
          console.error('AND検索エラー:', error);
          // エラーが発生しても処理を続行
        }
      }
      
      // ステップ3: 結果がない場合、空白区切りのクエリをOR演算子で結合して検索
      if ((results2.length === 0 || allResults.length === 0) && orQuery) {
        console.log(`複合キーワードをOR検索: "${orQuery}"`);
        try {
          const orResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
            SELECT 
              id,
              main_category,
              sub_category,
              detail_category,
              question,
              answer,
              is_template,
              usage,
              note,
              issue,
              "createdAt",
              "updatedAt",
              ts_rank(search_vector, to_tsquery('japanese', ${orQuery})) as rank
            FROM "Knowledge" 
            WHERE search_vector @@ to_tsquery('japanese', ${orQuery})
            ORDER BY rank DESC
          `;
          console.log('OR検索の結果:', orResults);
          
          // 結果をマージ
          orResults.forEach(result => {
            const existingIndex = allResults.findIndex(r => r.id === result.id);
            if (existingIndex >= 0) {
              // 既存のエントリを更新（より高いスコアがあれば更新）
              if ((result.rank || 0) > (allResults[existingIndex].ts_score || 0)) {
                allResults[existingIndex].ts_score = parseFloat(result.rank.toFixed(2));
                allResults[existingIndex].final_score = 
                  (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
                  (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
              }
            } else {
              // 新規エントリの追加
              allResults.push({
                ...result,
                ts_score: parseFloat(result.rank.toFixed(2)),
                sim_score: 0,
                final_score: parseFloat(result.rank.toFixed(2)) * 0.7 // 全文検索のみの場合
              });
            }
          });
        } catch (error) {
          console.error('OR検索エラー:', error);
          // エラーが発生しても処理を続行
        }
      }
      
      // ステップ4: プレーンテキスト検索（plainto_tsquery）を試みる
      if ((results2.length === 0 || allResults.length === 0) && plainQuery) {
        console.log(`プレーンテキスト検索: "${plainQuery}"`);
        try {
          const plainResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
            SELECT 
              id,
              main_category,
              sub_category,
              detail_category,
              question,
              answer,
              is_template,
              usage,
              note,
              issue,
              "createdAt",
              "updatedAt",
              ts_rank(search_vector, plainto_tsquery('japanese', ${plainQuery})) as rank
            FROM "Knowledge" 
            WHERE search_vector @@ plainto_tsquery('japanese', ${plainQuery})
            ORDER BY rank DESC
          `;
          console.log('プレーンテキスト検索の結果:', plainResults);
          
          // 結果をマージ
          plainResults.forEach(result => {
            const existingIndex = allResults.findIndex(r => r.id === result.id);
            if (existingIndex >= 0) {
              // 既存のエントリを更新（より高いスコアがあれば更新）
              if ((result.rank || 0) > (allResults[existingIndex].ts_score || 0)) {
                allResults[existingIndex].ts_score = parseFloat(result.rank.toFixed(2));
                allResults[existingIndex].final_score = 
                  (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
                  (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
              }
            } else {
              // 新規エントリの追加
              allResults.push({
                ...result,
                ts_score: parseFloat(result.rank.toFixed(2)),
                sim_score: 0,
                final_score: parseFloat(result.rank.toFixed(2)) * 0.7 // 全文検索のみの場合
              });
            }
          });
        } catch (error) {
          console.error('プレーンテキスト検索エラー:', error);
          // エラーが発生しても処理を続行
        }
      }
      
      // ステップ5: 特別な重要キーワードを使用した検索
      if (specialTerms.length > 0) {
        console.log(`特別キーワード検索: "${specialTerms.join(' ')}"`);
        try {
          for (const term of specialTerms) {
            const specialResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
              SELECT 
                id,
                main_category,
                sub_category,
                detail_category,
                question,
                answer,
                is_template,
                usage,
                note,
                issue,
                "createdAt",
                "updatedAt",
                ts_rank(search_vector, to_tsquery('japanese', ${term})) as rank
              FROM "Knowledge" 
              WHERE search_vector @@ to_tsquery('japanese', ${term})
              ORDER BY rank DESC
              LIMIT 5
            `;
            console.log(`特別キーワード "${term}" の検索結果:`, specialResults);
            
            // 結果をマージ（特別キーワードには高いスコアを与える）
            specialResults.forEach(result => {
              const existingIndex = allResults.findIndex(r => r.id === result.id);
              if (existingIndex >= 0) {
                // 既存のエントリを更新（特別キーワードには高いスコアを与える）
                const specialScore = parseFloat(result.rank.toFixed(2)) * 1.2; // 20%ボーナス
                if (specialScore > (allResults[existingIndex].ts_score || 0)) {
                  allResults[existingIndex].ts_score = specialScore;
                  allResults[existingIndex].final_score = 
                    (allResults[existingIndex].ts_score || 0) * 0.7 + // 全文検索に70%のウェイト
                    (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
                }
              } else {
                // 新規エントリの追加
                allResults.push({
                  ...result,
                  ts_score: parseFloat(result.rank.toFixed(2)) * 1.2, // 20%ボーナス
                  sim_score: 0,
                  final_score: parseFloat(result.rank.toFixed(2)) * 1.2 * 0.7 // 全文検索のみの場合
                });
              }
            });
          }
        } catch (error) {
          console.error('特別キーワード検索エラー:', error);
          // エラーが発生しても処理を続行
        }
      }
      
      // ステップ6: 繁忙期に関連するナレッジを優先
      if (hasBusyPeriod) {
        console.log('繁忙期関連のナレッジを検索');
        try {
          const busyPeriodResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
            SELECT 
              id,
              main_category,
              sub_category,
              detail_category,
              question,
              answer,
              is_template,
              usage,
              note,
              issue,
              "createdAt",
              "updatedAt",
              1.5 as rank
            FROM "Knowledge" 
            WHERE search_vector @@ to_tsquery('japanese', 'busy_period | 繁忙期 | 混雑 | ピーク')
               OR main_category ILIKE '%繁忙期%'
               OR sub_category ILIKE '%繁忙期%'
               OR question ILIKE '%繁忙期%'
               OR answer ILIKE '%繁忙期%'
            ORDER BY 
              CASE 
                WHEN usage = '✖️' THEN 1
                WHEN usage = '△' THEN 2
                ELSE 3
              END
          `;
          console.log('繁忙期関連の検索結果:', busyPeriodResults);
          
          // 結果をマージ（繁忙期関連には非常に高いスコアを与える）
          busyPeriodResults.forEach(result => {
            const existingIndex = allResults.findIndex(r => r.id === result.id);
            if (existingIndex >= 0) {
              // 既存のエントリを更新（繁忙期関連には非常に高いスコアを与える）
              allResults[existingIndex].ts_score = 1.5; // 最高スコア
              allResults[existingIndex].final_score = 
                1.5 * 0.7 + // 全文検索に70%のウェイト
                (allResults[existingIndex].sim_score || 0) * 0.3; // 類似度に30%のウェイト
            } else {
              // 新規エントリの追加
              allResults.push({
                ...result,
                ts_score: 1.5, // 最高スコア
                sim_score: 0,
                final_score: 1.5 * 0.7 // 全文検索のみの場合
              });
            }
          });
        } catch (error) {
          console.error('繁忙期関連検索エラー:', error);
          // エラーが発生しても処理を続行
        }
      }
      
    } catch (error) {
      console.error('全文検索エラー:', error);
      // エラーが発生しても処理を続行
    }

    // 重複を除外
    const uniqueResults = Array.from(
      new Map(allResults.map(item => [item.id, item])).values()
    );
    
    // 最終スコアで降順ソート
    uniqueResults.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    
    // 上位の結果を選択
    const topResults = uniqueResults.slice(0, 10);
    
    // 最終的な結果を整形
    const finalResults = topResults.map(result => ({
      ...result,
      relevance: result.final_score || 0
    }));
    
    console.log('最終結果:', finalResults);
    
    return finalResults;
  } catch (error) {
    console.error('検索エラー:', error);
    return null;
  }
} 