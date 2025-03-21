import { prisma } from './db.js';
import { Knowledge, SeasonalInfo } from '@prisma/client';
import { extractDatesFromText, checkBusyPeriods, formatDateToJapanese } from './date-utils.js';
import { searchKnowledgeByTags } from './tag-search.js';

/**
 * 日本語検索クエリの前処理を行う関数
 * 
 * @param query 検索クエリ
 * @returns 前処理済みの検索クエリ
 */
async function preprocessJapaneseQuery(query: string): Promise<{ 
  cleanedQuery: string; 
  orQuery: string | null;
  webSearchQuery: string;
  keyTerms: string[];
  andQuery: string | null;
  plainQuery: string | null;
  specialTerms: string[];
  synonymExpanded: string[];
}> {
  // ステップ1: 入力の正規化
  const normalized = query.trim().replace(/\s+/g, ' ');
  
  if (!normalized) {
    return { 
      cleanedQuery: '', 
      orQuery: null,
      webSearchQuery: '',
      keyTerms: [],
      andQuery: null,
      plainQuery: null,
      specialTerms: [],
      synonymExpanded: []
    };
  }
  
  // ステップ2: キーワードの抽出と同義語展開
  const keyTerms = extractKeyTerms(normalized);
  const synonymExpanded = await expandSynonyms(keyTerms);
  
  // ステップ3: 特別な重要キーワードを検出
  const specialTerms = extractSpecialTerms(normalized);
  
  // ステップ4: 検索クエリの構築
  let orQuery = null;
  let andQuery = null;
  let plainQuery = null;
  
  // 同義語を含めた検索用語の作成
  const searchTerms = [...new Set([...keyTerms, ...synonymExpanded])];
  
  if (searchTerms.length > 1) {
    // OR検索用クエリ（部分一致）
    orQuery = searchTerms.map(term => `${term}:*`).join(' | ');
    
    // AND検索用クエリ（完全一致）
    andQuery = searchTerms.map(term => `${term}`).join(' & ');
    
    // プレーンテキスト検索用クエリ
    plainQuery = searchTerms.join(' & ');
  } else if (searchTerms.length === 1) {
    plainQuery = searchTerms[0];
  }
  
  // ステップ5: websearch_to_tsquery用のクエリを作成
  const webSearchQuery = searchTerms.join(' | ');
  
  return {
    cleanedQuery: normalized,
    orQuery,
    webSearchQuery,
    keyTerms,
    andQuery,
    plainQuery,
    specialTerms,
    synonymExpanded
  };
}

/**
 * 重要な用語を抽出する関数
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
    'みた', 'みる', 'もう', 'やっ', 'よく', 'わか', 'について', 'に関して', 'を', 'は', 'が',
    'の', 'に', 'へ', 'で', 'と', 'も', 'や'
  ];

  // 重要な単語のパターン
  const importantPatterns = [
    /予約|キャンセル|料金|支払|駐車|送迎|車種|サイズ|営業|時間|方法|手続|手順/,
    /オンライン|インターネット|ウェブ|スマホ|アプリ/,
    /国際線|国内線|到着|出発|帰国|出国/,
    /混雑|繁忙|ピーク|満車|空き/,
    /クレジット|カード|現金|電子|マネー/,
    /領収書|レシート|明細|証明書/,
    /割引|クーポン|ディスカウント|特典/,
    /精算|会計|決済|支払い/
  ];

  // 文字列を分割（助詞や句読点で区切る）
  const segments = text.split(/[はがのにへでとやもを、。．！？!?.\s]+/).filter(Boolean);
  
  // 重要な用語を抽出
  const terms = segments
    // 1文字以上の単語を抽出（2文字以上から変更）
    .filter(term => term.length >= 1)
    // ストップワードを除外
    .filter(term => !commonStopwords.includes(term))
    // 数字のみの単語を除外（ただし日付や時間の可能性があるものは保持）
    .filter(term => !/^\d+$/.test(term) || /\d+[月日時分]|\d+:\d+/.test(term));

  // 重要なパターンにマッチする単語を優先
  const importantTerms = terms.filter(term => 
    importantPatterns.some(pattern => pattern.test(term))
  );

  // 複合語の処理
  const compounds = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const compound = segments[i] + segments[i + 1];
    if (compound.length >= 3 && compound.length <= 10 && 
        importantPatterns.some(pattern => pattern.test(compound))) {
      compounds.push(compound);
    }
  }

  // 結果を結合して重複を除去
  const allTerms = [...new Set([...importantTerms, ...compounds, ...terms])];
  
  // 上位20語に制限（15語から増やす）
  return allTerms.slice(0, 20);
}

/**
 * 特別な重要キーワードを抽出する関数
 * 「オンライン」「駐車場」などの特定の重要単語を検出
 */
function extractSpecialTerms(text: string): string[] {
  const specialKeywords = [
    'オンライン', '駐車場', '予約', 'キャンセル', '料金', '支払い', '送迎', '車種', 'サイズ',
    '国際線', 'インターナショナル', '朝帰国', 'レクサス', '外車', 'BMW', 'ベンツ', 'アウディ',
    '満車', '空き', '定員', '人数', '繁忙期', '混雑', 'ピーク',
    '営業時間', '営業', '開店', '閉店', '営業日', '休業日',
    '領収書', 'レシート', '明細', '証明書',
    '割引', 'クーポン', 'ディスカウント', '特典',
    '精算', '会計', '決済', 'カード', '現金', '電子マネー',
    '解約', '取り消し', '返金'
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
 * 同義語を展開する関数
 */
async function expandSynonyms(terms: string[]): Promise<string[]> {
  const expanded: string[] = [];
  
  // 各タームに対して同義語を検索
  for (const term of terms) {
    // まず、タグを検索
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { tag_name: { contains: term, mode: 'insensitive' } },
          {
            tag_synonyms: {
              some: {
                synonym: { contains: term, mode: 'insensitive' }
              }
            }
          }
        ]
      },
      include: {
        tag_synonyms: true
      }
    });
    
    // タグ名を追加
    tags.forEach(tag => {
      expanded.push(tag.tag_name);
      // 同義語も追加
      tag.tag_synonyms.forEach(syn => {
        expanded.push(syn.synonym);
      });
    });
  }
  
  // 重複を除去して返す
  return [...new Set([...terms, ...expanded])];
}

/**
 * カテゴリ情報を活用して検索を強化する関数
 */
function boostWithCategories(terms: string[]): string[] {
  const boostedTerms = [...terms];
  
  // 予約に関する単語があれば「予約」カテゴリを追加
  if (terms.some(term => /予約|申込|申し込み|キャンセル|リザーブ/.test(term))) {
    boostedTerms.push('予約');
  }
  
  // 料金に関する単語があれば「料金」カテゴリを追加
  if (terms.some(term => /料金|価格|費用|支払い|決済|コスト|値段|代金|金額/.test(term))) {
    boostedTerms.push('料金');
  }
  
  // 駐車場に関する単語があれば「駐車場」カテゴリを追加
  if (terms.some(term => /駐車|車|パーキング/.test(term))) {
    boostedTerms.push('駐車場');
  }
  
  // 営業時間に関する単語があれば「営業時間」カテゴリを追加
  if (terms.some(term => /営業時間|営業|開店|閉店|営業日/.test(term))) {
    boostedTerms.push('営業時間');
  }
  
  // キャンセルに関する単語があれば「キャンセル」カテゴリを追加
  if (terms.some(term => /キャンセル|解約|取り消し|返金/.test(term))) {
    boostedTerms.push('キャンセル');
  }
  
  // 支払いに関する単語があれば「支払い」カテゴリを追加
  if (terms.some(term => /支払い|精算|会計|決済|カード|現金|電子マネー/.test(term))) {
    boostedTerms.push('支払い');
  }
  
  return boostedTerms;
}

// 検索結果の型定義を更新
type SearchResult = Knowledge & {
  rank?: number;
  ts_score?: number;
  sim_score?: number;
  tag_score?: number;
  category_score?: number;
  final_score?: number;
  relevance?: number;
};

// 検索結果のスコアリングを更新
function calculateSearchScore(
  tsScore: number,
  simScore: number,
  tagScore: number,
  categoryScore: number
): number {
  // 新しい重み付けスキーム
  return (
    (tsScore * 0.4) +      // 全文検索スコア（40%）
    (simScore * 0.2) +     // 類似度スコア（20%）
    (tagScore * 0.2) +     // タグスコア（20%）
    (categoryScore * 0.2)  // カテゴリスコア（20%）
  );
}

/**
 * カテゴリスコアを計算する関数
 * 
 * @param knowledge ナレッジエントリ
 * @param keyTerms 検索キーワード
 * @returns カテゴリスコア（0.0〜1.0）
 */
function calculateCategoryScore(knowledge: Knowledge, keyTerms: string[]): number {
  let score = 0;
  
  // メインカテゴリの一致度
  if (knowledge.main_category) {
    const mainCategoryMatch = keyTerms.some(term => 
      knowledge.main_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (mainCategoryMatch) score += 0.4;
  }
  
  // サブカテゴリの一致度
  if (knowledge.sub_category) {
    const subCategoryMatch = keyTerms.some(term => 
      knowledge.sub_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (subCategoryMatch) score += 0.3;
  }
  
  // 詳細カテゴリの一致度
  if (knowledge.detail_category) {
    const detailCategoryMatch = keyTerms.some(term => 
      knowledge.detail_category?.toLowerCase().includes(term.toLowerCase())
    );
    if (detailCategoryMatch) score += 0.3;
  }
  
  return Math.min(score, 1.0);
}

/**
 * カテゴリ情報に基づいてナレッジを検索する関数
 */
async function searchKnowledgeByCategories(
  mainCategory: string,
  subCategory?: string
): Promise<Knowledge[]> {
  const whereConditions: any = {
    OR: [
      { main_category: { contains: mainCategory, mode: 'insensitive' } },
      { sub_category: { contains: mainCategory, mode: 'insensitive' } },
      { detail_category: { contains: mainCategory, mode: 'insensitive' } }
    ]
  };
  
  if (subCategory) {
    whereConditions.OR.push(
      { main_category: { contains: subCategory, mode: 'insensitive' } },
      { sub_category: { contains: subCategory, mode: 'insensitive' } },
      { detail_category: { contains: subCategory, mode: 'insensitive' } }
    );
  }
  
  return await prisma.knowledge.findMany({
    where: whereConditions
  });
}

/**
 * 高度な全文検索を実行する関数
 * 
 * @param query 検索クエリ
 * @returns 検索結果
 */
export async function searchKnowledge(query: string) {
  try {
    const { 
      cleanedQuery, 
      orQuery, 
      webSearchQuery, 
      keyTerms, 
      andQuery, 
      plainQuery, 
      specialTerms,
      synonymExpanded
    } = await preprocessJapaneseQuery(query);
    
    if (!cleanedQuery) {
      console.log('空のクエリが指定されました');
      return null;
    }
    
    // 前処理されたクエリ情報をログに出力
    console.log('前処理されたクエリ情報:', {
      cleanedQuery,
      orQuery,
      webSearchQuery,
      keyTerms,
      andQuery,
      plainQuery,
      specialTerms,
      synonymExpanded
    });
    
    // 検索結果を格納する配列
    let allResults: SearchResult[] = [];
    
    // 方法1: タグベース検索
    console.log('方法1: タグベース検索');
    const tagResults = await searchKnowledgeByTags([...keyTerms, ...synonymExpanded]);
    
    tagResults.forEach(result => {
      const categoryScore = calculateCategoryScore(result.knowledge, keyTerms);
      allResults.push({
        ...result.knowledge,
        ts_score: 0,
        sim_score: 0,
        tag_score: result.score,
        category_score: categoryScore,
        final_score: calculateSearchScore(0, 0, result.score, categoryScore)
      });
    });
    
    // 方法2: カテゴリベース検索
    console.log('方法2: カテゴリベース検索');
    const categoryResults = await searchKnowledgeByCategories(
      keyTerms.join(' '),
      synonymExpanded.join(' ')
    );
    
    categoryResults.forEach(result => {
      const existingIndex = allResults.findIndex(r => r.id === result.id);
      const categoryScore = calculateCategoryScore(result, keyTerms);
      
      if (existingIndex >= 0) {
        allResults[existingIndex].category_score = Math.max(
          allResults[existingIndex].category_score || 0,
          categoryScore
        );
      } else {
        allResults.push({
          ...result,
          ts_score: 0,
          sim_score: 0,
          tag_score: 0,
          category_score: categoryScore,
          final_score: calculateSearchScore(0, 0, 0, categoryScore)
        });
      }
    });
    
    // 方法3: 全文検索
    console.log('方法3: 全文検索');
    if (webSearchQuery) {
      const textSearchResults = await prisma.$queryRaw<(Knowledge & { rank: number })[]>`
        SELECT 
          k.*,
          ts_rank(k.search_vector, websearch_to_tsquery('japanese', ${webSearchQuery})) as rank
        FROM "Knowledge" k
        WHERE k.search_vector @@ websearch_to_tsquery('japanese', ${webSearchQuery})
        ORDER BY rank DESC
      `;
      
      textSearchResults.forEach(result => {
        const existingIndex = allResults.findIndex(r => r.id === result.id);
        const categoryScore = calculateCategoryScore(result, keyTerms);
        const tsScore = parseFloat(result.rank.toFixed(2));
        
        if (existingIndex >= 0) {
          allResults[existingIndex].ts_score = Math.max(
            allResults[existingIndex].ts_score || 0,
            tsScore
          );
        } else {
          allResults.push({
            ...result,
            ts_score: tsScore,
            sim_score: 0,
            tag_score: 0,
            category_score: categoryScore,
            final_score: calculateSearchScore(tsScore, 0, 0, categoryScore)
          });
        }
      });
    }
    
    // 最終スコアの計算と結果のソート
    allResults = allResults.map(result => ({
      ...result,
      final_score: calculateSearchScore(
        result.ts_score || 0,
        result.sim_score || 0,
        result.tag_score || 0,
        result.category_score || 0
      )
    }));
    
    allResults.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));
    
    // 日付検出と繁忙期チェック
    const dates = extractDatesFromText(query);
    const busyPeriodResults = dates.length > 0 ? await checkBusyPeriods(dates) : [];
    const hasBusyPeriod = busyPeriodResults.some(result => result.busyPeriod !== null);
    
    return {
      results: allResults.slice(0, 10),
      allResults,
      keyTerms,
      synonymExpanded,
      dates,
      busyPeriods: busyPeriodResults,
      hasBusyPeriod
    };
  } catch (error) {
    console.error('検索エラー:', error);
    throw error;
  }
}