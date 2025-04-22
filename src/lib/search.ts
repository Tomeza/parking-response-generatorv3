import { Prisma } from '@prisma/client';
import { prisma } from './db';
import { SearchResult, KuromojiToken } from './common-types';
// @ts-ignore - kuromojiモジュールに型定義がありません
import kuromoji from 'kuromoji'; // Kuromoji.jsをインポート

// 追加: 検索結果キャッシュの型定義
interface SearchCache {
  query: string;
  tags: string;
  timestamp: number;
  results: SearchResult[];
}

// 追加: 検索結果のキャッシュ（メモリ内）
const searchCache: SearchCache[] = [];
// 追加: キャッシュの有効期限（ミリ秒）
const CACHE_TTL = 5 * 60 * 1000; // 5分
// 追加: 最大キャッシュエントリ数
const MAX_CACHE_ENTRIES = 50;

// 追加: 検索パフォーマンスメトリクス
interface SearchMetrics {
  totalSearches: number;
  cacheHits: number;
  cacheMisses: number;
  averageSearchTime: number;
  totalSearchTime: number;
}

// 追加: 検索パフォーマンスメトリクスの初期化
const searchMetrics: SearchMetrics = {
  totalSearches: 0,
  cacheHits: 0,
  cacheMisses: 0,
  averageSearchTime: 0,
  totalSearchTime: 0
};

// 結果に含めるKnowledgeモデルのカラムを選択
const selectKnowledgeFields = {
  id: true,
  main_category: true,
  sub_category: true,
  detail_category: true,
  question: true,
  answer: true,
  is_template: true,
  usage: true,
  note: true,
  issue: true,
  createdAt: true,
  updatedAt: true,
};

// スコアリング用の拡張タイプ
type KnowledgeWithScore = Prisma.KnowledgeGetPayload<{ select: typeof selectKnowledgeFields }> & { 
  pgroonga_score: number;
  adjusted_score: number;
  exact_match_bonus: number;
  category_match_bonus: number;
};

// 最小スコアしきい値 - これより低いスコアの結果は除外
const MIN_SCORE_THRESHOLD = 0.1;

// スコア調整の重み付け
const WEIGHTS = {
  EXACT_MATCH: 5.0,        // 完全一致 (重みを増加)
  PHRASE_MATCH: 3.0,       // フレーズ一致 (重みを増加)
  CATEGORY_MATCH: 2.5,     // カテゴリ一致 (重みを増加)
  IS_TEMPLATE: 0.5,        // テンプレート
  QUESTION_MATCH: 1.5,     // 質問一致 (重みを増加)
  ANSWER_MATCH: 0.7,       // 回答一致 (重みを増加)
  PGROONGA_MULTIPLIER: 2.5 // PGroongaスコアの乗数 (増加)
};

// KuromojiのTokenizerを保持する変数（非同期で初期化）
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

// PromiseでKuromojiの初期化をラップ
const tokenizerPromise = new Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null>((resolve, reject) => {
  kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((err: Error | null, _tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures>) => {
    if (err) {
      console.error('Kuromoji tokenizer build error:', err);
      reject(err);
    } else {
      console.log('Kuromoji tokenizer ready.');
      tokenizer = _tokenizer;
      resolve(_tokenizer);
    }
  });
}).catch(err => {
  console.error('Kuromoji Promise initialization catch:', err);
  return null;
});

// 抽出する品詞
const VALID_POS = ['名詞', '動詞', '形容詞', '副詞']; 
// 追加: 重要品詞の重み付け
const POS_WEIGHTS = {
  '名詞': 1.5,      // 名詞は最も重要
  '名詞-固有名詞': 2.0, // 固有名詞はさらに重要
  '名詞-一般': 1.8,  // 一般名詞は重要
  '名詞-サ変接続': 1.7, // "サ変接続"の名詞も重要（例: 利用、予約など）
  '動詞': 1.0,
  '形容詞': 0.8,
  '副詞': 0.7
};

// 追加: ストップワードリスト - 検索には役立たない一般的な単語
const STOP_WORDS = [
  'する', 'ある', 'いる', 'なる', 'できる', 'れる', 'られる',
  'ない', 'この', 'その', 'あの', 'どの',
  'こと', 'もの', 'ため', 'よう', 'そう', 'ほう',
  'です', 'ます', 'ください', 'なり', 'いただく'
];

// 追加: 重要単語リスト - 特に重視すべき単語
const IMPORTANT_WORDS = [
  '予約', '料金', '支払', '支払い', '営業', '時間', '駐車', '送迎', 
  'キャンセル', '変更', '定員', '超過', '超える', '制限', '人数', 
  '乗車', '同乗', '何人', '何名', '席', '送迎車', '乗れる', '上限',
  '利用制限', '利用条件', '受入', '受入不可',
  '予約変更', '日時変更', '日程変更', '予約修正', '変更手続き', '予約日変更',
  '荷物', '手荷物', '大きな', '大型', 'スーツケース', 'キャリーケース', 
  'トランク', '運ぶ', '持ち込み', '持込', '制限', 'サイズ', '重量',
  // 数量関連の単語を追加
  '何個', 'いくつ', '個数', '数量',
  // ひとり送迎関連
  'ひとり送迎', 'お一人様', '単独送迎', '複数台',
  // 追加: 複数台利用のクエリかどうかのチェック関数
  '団体',
  // 追加: アクセス関連
  'アクセス', '行き方', '場所', '地図', '最寄り', '駅', '道順', 'ルート',
  // 追加: 満車・空き・通知関連
  '満車', '空車', '空き', '空く', '通知', '連絡', 'キャンセル待ち'
];

// 追加: 特別なカテゴリマッピング - 特定のクエリパターンと関連するカテゴリの関連付け
const CATEGORY_QUERY_MAPPING = {
  '定員': ['送迎関連', '制限事項', '定員', '人数制限'],
  '人数': ['送迎関連', '制限事項', '定員', '人数制限'],
  '何人': ['送迎関連', '制限事項', '定員', '人数制限'],
  '何名': ['送迎関連', '制限事項', '定員', '人数制限'],
  '乗車': ['送迎関連', '制限事項', '定員', '人数制限'],
  '送迎': ['送迎関連', '制限事項'],
  '超える': ['利用制限', '送迎関連', '制限事項'],
  '超過': ['利用制限', '送迎関連', '制限事項'],
  '営業時間': ['利用の流れ', '営業時間'],
  '何時': ['利用の流れ', '営業時間'],
  '料金': ['料金関連'],
  '支払': ['料金関連', '支払方法'],
  'キャンセル': ['予約関連', 'キャンセル'],
  // 予約変更関連を追加
  '予約変更': ['予約関連', '変更'],
  '変更': ['予約関連', '変更'],
  '日程変更': ['予約関連', '変更'],
  '日時変更': ['予約関連', '変更'],
  // 荷物関連を追加
  '荷物': ['送迎関連', '荷物制限', '制限事項'],
  '手荷物': ['送迎関連', '荷物制限', '制限事項'],
  'スーツケース': ['送迎関連', '荷物制限', '制限事項'],
  'キャリーケース': ['送迎関連', '荷物制限', '制限事項'],
  '大きな': ['送迎関連', '荷物制限', '制限事項'],
  '大型': ['送迎関連', '荷物制限', '制限事項'],
  'トランク': ['送迎関連', '荷物制限', '車両情報'],
  // 数量関連を追加 (荷物と組み合わせて使う)
  '何個': ['送迎関連', '荷物制限', '制限事項'],
  'いくつ': ['送迎関連', '荷物制限', '制限事項'],
  '個数': ['送迎関連', '荷物制限', '制限事項'],
  // ひとり送迎関連
  'ひとり送迎': ['送迎関連', 'ひとり送迎', '人数制限'],
  'お一人様': ['送迎関連', 'ひとり送迎', '人数制限'],
  '6名': ['送迎関連', 'ひとり送迎', '人数制限'],
  // 追加: 複数台利用のクエリかどうかのチェック関数
  '団体': ['送迎関連', '人数制限'],
  // 追加: アクセス関連
  'アクセス': ['アクセス'],
  '行き方': ['アクセス'],
  '場所': ['アクセス', '住所'],
  '地図': ['アクセス', '検索方法'],
  '最寄り': ['アクセス', '目印'],
  '駅': ['アクセス'],
  // 追加: 満車・空き・通知関連
  '満車': ['予約関連', '利用状況', '料金関連'], // 料金関連も含む可能性
  '空車': ['予約関連', '利用状況'],
  '空き': ['予約関連', '利用状況', 'キャンセル'],
  '空く': ['予約関連', '利用状況', 'キャンセル'],
  '通知': ['予約関連', '連絡手段', 'その他'],
  '連絡': ['予約関連', '連絡手段', 'その他'],
  'キャンセル待ち': ['予約関連', 'キャンセル', '利用状況']
};

// 追加: 荷物関連のクエリかどうかのチェック関数
function isLuggageRelatedQuery(query: string): boolean {
  // 明示的な荷物関連キーワード
  if (query.includes('荷物') || 
      query.includes('手荷物') || 
      query.includes('スーツケース') || 
      query.includes('キャリーケース') ||
      (query.includes('大きな') && query.includes('荷物')) ||
      (query.includes('大型') && query.includes('荷物')) ||
      query.includes('トランク') ||
      (query.includes('荷物') && query.includes('サイズ')) ||
      (query.includes('荷物') && query.includes('大きさ')) ||
      (query.includes('荷物') && query.includes('重さ')) ||
      (query.includes('荷物') && query.includes('制限'))) {
    return true;
  }
  return false;
}

// 追加: 予約変更関連のクエリかどうかのチェック関数
function isReservationChangeQuery(query: string): boolean {
  // 明示的な予約変更キーワード
  if (query.includes('予約変更') || 
      query.includes('予約の変更') || 
      query.includes('予約を変更') || 
      query.includes('日程変更') || 
      query.includes('日時変更')) {
    return true;
  }

  // 予約と変更/修正の両方を含む場合
  if (query.includes('予約') && 
      (query.includes('変更') || 
       query.includes('修正') || 
       query.includes('変えたい') || 
       query.includes('キャンセル'))) {
    return true;
  }

  return false;
}

// 追加: 複数台利用のクエリかどうかのチェック関数
function isLargeGroupOrMultipleVehicleQuery(query: string): boolean {
  return query.includes('複数台') || query.includes('2台') || query.includes('二台') || query.includes('団体');
}

// 追加: アクセス関連のクエリかどうかのチェック関数
function isAccessQuery(query: string): boolean {
  const accessKeywords = ['アクセス', '行き方', '場所', '地図', 'どうやって', '行く', '最寄り', '駅', '道順', 'ルート'];
  return accessKeywords.some(keyword => query.includes(keyword)) || 
         query.includes('どこ') || query.includes('どの');
}

// 追加: 満車関連のクエリかどうかのチェック関数
function isFullParkingQuery(query: string): boolean {
  // 満車、空き、通知、キャンセル待ちに関するキーワードを広く含める
  return query.includes('満車') || 
         query.includes('空きがない') || 
         query.includes('空いてない') || 
         query.includes('停められない') || 
         query.includes('とめられない') || 
         query.includes('空き') || // 「空き」を追加
         query.includes('空く') || // 「空く」を追加
         query.includes('通知') || // 「通知」を追加
         query.includes('連絡') || // 「連絡」を追加
         query.includes('キャンセル待ち'); // 「キャンセル待ち」を追加
}

/**
 * 追加: キャッシュから検索結果を取得する関数
 */
function getFromCache(query: string, tags: string): SearchResult[] | null {
  const now = Date.now();
  const cachedEntry = searchCache.find(entry => 
    entry.query === query && 
    entry.tags === tags && 
    (now - entry.timestamp) < CACHE_TTL
  );
  
  if (cachedEntry) {
    searchMetrics.cacheHits++;
    return cachedEntry.results;
  }
  
  searchMetrics.cacheMisses++;
  return null;
}

/**
 * 追加: 検索結果をキャッシュに保存する関数
 */
function saveToCache(query: string, tags: string, results: SearchResult[]): void {
  // キャッシュが上限に達した場合、最も古いエントリを削除
  if (searchCache.length >= MAX_CACHE_ENTRIES) {
    searchCache.sort((a, b) => a.timestamp - b.timestamp);
    searchCache.shift(); // 最も古いエントリを削除
  }
  
  // 新しいエントリをキャッシュに追加
  searchCache.push({
    query,
    tags,
    timestamp: Date.now(),
    results
  });
}

/**
 * 追加: 検索メトリクスを更新する関数
 */
function updateMetrics(searchTime: number): void {
  searchMetrics.totalSearches++;
  searchMetrics.totalSearchTime += searchTime;
  searchMetrics.averageSearchTime = searchMetrics.totalSearchTime / searchMetrics.totalSearches;
}

/**
 * 追加: 検索メトリクスを取得する関数（外部公開）
 */
export function getSearchMetrics(): SearchMetrics {
  return { ...searchMetrics };
}

// ひとり送迎関連のクエリかどうかのチェック関数 (シンプル版)
function isSoloShuttleQuery(query: string): boolean {
  return query.includes('ひとり送迎') || query.includes('お一人様') || 
         (query.includes('送迎') && (query.includes('一人') || query.includes('1人'))) ||
         query.includes('6名'); // 6名以上など
}

// パターンマッチ関数
function matchesMultipleCarsPattern(query: string): boolean {
  return /\d+\s*台.*\d+\s*名/.test(query);
}

function matchesWheelchairSoloPattern(query: string): boolean {
  return /車椅子.*(一人|1人|単独)/.test(query);
}

// 追加: クエリが車椅子関連かチェックする関数
function isWheelchairQuery(query: string): boolean {
  return query.includes('車椅子') || query.includes('くるまいす');
}

/**
 * 主要な検索関数 - 与えられたクエリと（オプションの）タグに基づいて知識を検索
 */
export async function searchKnowledge(query: string, tags?: string): Promise<SearchResult[]> {
  // 追加: 検索開始時間を記録
  const searchStartTime = Date.now();
  
  const normalizedQuery = query.trim();
  const decodedTags = tags ? decodeURIComponent(tags) : '';

  if (!normalizedQuery) {
    return [];
  }

  // 予約変更関連のクエリかどうかをチェック
  const isReservationChange = isReservationChangeQuery(normalizedQuery);
  if (isReservationChange) {
    console.log('予約変更関連のクエリを検出しました');
  }

  // 荷物関連のクエリかどうかをチェック
  const isLuggageRelated = isLuggageRelatedQuery(normalizedQuery);
  if (isLuggageRelated) {
    console.log('荷物関連のクエリを検出しました');
  }

  // ひとり送迎関連のクエリかどうかをチェック
  const isSoloShuttle = isSoloShuttleQuery(normalizedQuery);
  if (isSoloShuttle) {
    console.log('ひとり送迎関連のクエリを検出しました');
  }

  // 修正: 関数呼び出しと変数名を変更
  const isLargeGroupOrMultipleVehicle = isLargeGroupOrMultipleVehicleQuery(normalizedQuery);
  if (isLargeGroupOrMultipleVehicle) {
    console.log('複数台利用または団体利用のクエリを検出しました'); // ログメッセージも修正
  }

  // 追加: アクセス関連クエリの検出ログ
  const isAccess = isAccessQuery(normalizedQuery);
  if (isAccess) {
    console.log('アクセス関連のクエリを検出しました');
  }

  // 追加: 満車関連クエリの検出ログ
  const isFullParking = isFullParkingQuery(normalizedQuery);
  if (isFullParking) {
    console.log('満車関連のクエリを検出しました');
  }

  // 追加: キャッシュをチェック
  const cachedResults = getFromCache(normalizedQuery, decodedTags);
  if (cachedResults) {
    console.log('キャッシュから検索結果を取得しました');
    
    // 検索メトリクスを更新（キャッシュヒット時は処理時間を0としてカウント）
    updateMetrics(0);
    
    return cachedResults;
  }

  if (!tokenizer) {
    tokenizer = await tokenizerPromise;
    if (!tokenizer) {
      console.error('Kuromoji Tokenizer is not available.');
      // Fallback to simple word splitting if tokenizer fails
      const fallbackTerms = normalizedQuery
        .split(/[\s、。．！？!?.]+/)
        .filter(term => term.length > 1);
        
      const results = await simpleSearch(normalizedQuery, fallbackTerms);
      
      // 検索時間を計算しメトリクスを更新
      const searchTime = Date.now() - searchStartTime;
      updateMetrics(searchTime);
      
      // フォールバック結果もキャッシュに保存
      saveToCache(normalizedQuery, decodedTags, results);
      
      return results;
    }
  }

  let finalSearchTerms: string[] = [normalizedQuery];
  // 追加: 品詞ごとの重み付け情報を保持
  let termWeights: Record<string, number> = {};

  try {
    console.log('検索クエリ:', normalizedQuery);
    console.log('入力タグ:', decodedTags);

    // フレーズとしての完全一致検索のために元のクエリも保持
    const phraseQuery = normalizedQuery;

    // Kuromojiによる形態素解析
    const tokens = tokenizer.tokenize(normalizedQuery);

    // 修正: 重要な品詞のみを抽出し、基本形を取得、ストップワード除外、重み付け情報追加
    const searchTerms: string[] = tokens
        .filter((token: KuromojiToken) => {
          // 品詞が有効かつストップワードでない場合
          return VALID_POS.some(pos => token.pos.startsWith(pos)) && 
                 !STOP_WORDS.includes(token.basic_form) &&
                 token.basic_form.length > 1;
        })
        .map((token: KuromojiToken) => {
          const term = token.basic_form === '*' ? token.surface_form : token.basic_form;
          // 品詞に基づく重み付け情報を保存
          let weight = 1.0; // デフォルト
          for (const [posType, posWeight] of Object.entries(POS_WEIGHTS)) {
            if (token.pos.startsWith(posType)) {
              weight = posWeight;
              break;
            }
          }
          // 単語の長さによる補正（短すぎる単語は重要度低）
          if (term.length <= 1) weight *= 0.5;
          else if (term.length >= 4) weight *= 1.2; // 長い単語は重要度高

          // 単語の位置による重み付け（質問の先頭に近いほど重要）
          const positionInQuery = token.position;
          if (positionInQuery < 3) {
            weight *= 1.3; // 先頭付近の単語は30%増し
          }
          
          // 重要単語リストに含まれる場合、さらに重みを増やす
          if (IMPORTANT_WORDS.some(w => term.includes(w))) {
            weight *= 1.5;
          }

          termWeights[term] = weight;
          return term;
        })
        .filter((term: string) => term !== null && term.length > 1);
    
    // 重複排除
    const uniqueSearchTerms: string[] = [...new Set(searchTerms)];
    console.log('検索単語 (Kuromoji):', uniqueSearchTerms);
    console.log('単語重み:', termWeights);
    
    if (uniqueSearchTerms.length > 0) {
        finalSearchTerms = uniqueSearchTerms;
    }

    // 追加: 単語のコンビネーション（n-gram）追加
    const bigramTerms = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      const token1 = tokens[i];
      const token2 = tokens[i + 1];
      if (VALID_POS.some(pos => token1.pos.startsWith(pos)) && 
          VALID_POS.some(pos => token2.pos.startsWith(pos))) {
        const term1 = token1.basic_form === '*' ? token1.surface_form : token1.basic_form;
        const term2 = token2.basic_form === '*' ? token2.surface_form : token2.basic_form;
        if (term1.length > 1 && term2.length > 1) {
          const bigram = `${term1}${term2}`;
          bigramTerms.push(bigram);
        }
      }
    }
    
    if (bigramTerms.length > 0) {
      console.log('Bigram検索単語:', bigramTerms);
      // 重要なbigram用の条件を追加
      finalSearchTerms = [...finalSearchTerms, ...bigramTerms];
    }

    console.log('[DEBUG] Final search terms:', finalSearchTerms);

    // --- 改善されたPGroongaクエリ構築 ---
    // 1. 完全一致にもっと高いプライオリティを与える
    const exactMatchCondition = Prisma.sql`(
      k.question &@~ ${phraseQuery} OR 
      k.answer &@~ ${phraseQuery}
    )`;
    
    // 2. 修正: 単語ごとの検索条件を強化 - 重み付けを反映
    const termConditionsArray = finalSearchTerms.map(term => {
      // 重み付けに基づいて条件を構築（デフォルトは1.0）
      const weight = termWeights[term] || 1.0;
      return Prisma.sql`(
        (k.question &@~ ${term}) OR 
        (k.answer &@~ ${term})
      )`;
    });
    
    // 少なくとも1つの条件は満たす必要がある
    const termConditions = termConditionsArray.length > 0 
        ? Prisma.sql`(${Prisma.join(termConditionsArray, ' OR ')})` 
        : Prisma.sql`(TRUE)`;
    
    // 3. カテゴリ検索条件のスコア寄与を強化
    const categoryConditions = finalSearchTerms.map(term => {
      return Prisma.sql`(
        (k.main_category &@~ ${term}) OR 
        (k.sub_category &@~ ${term}) OR 
        (k.detail_category &@~ ${term})
      )`;
    });
    
    const categoryCondition = categoryConditions.length > 0
        ? Prisma.sql`(${Prisma.join(categoryConditions, ' OR ')})` 
        : Prisma.sql`(FALSE)`;
    
    // 「営業時間」に関する完全一致クエリに対する特別な条件
    const businessHoursExactMatch = normalizedQuery.includes('営業時間') || 
                                    normalizedQuery.includes('何時から') || 
                                    normalizedQuery.includes('何時まで') ||
                                    normalizedQuery.includes('駐車場 時間') ||
                                    normalizedQuery.includes('利用時間');
    
    // 営業時間関連のクエリかどうかの判定を強化
    const isBusinessHoursQuery = 
        businessHoursExactMatch || 
        (normalizedQuery.includes('営業') && normalizedQuery.includes('時間')) || 
        (normalizedQuery.includes('営業') && normalizedQuery.includes('何時')) ||
        normalizedQuery.includes('深夜') ||
        normalizedQuery.includes('24時間') ||
        (normalizedQuery.includes('朝') && normalizedQuery.includes('夜')) ||
        normalizedQuery.includes('早朝') ||
        normalizedQuery.includes('遅く') && (normalizedQuery.includes('開いて') || normalizedQuery.includes('開く') || normalizedQuery.includes('閉まる') || normalizedQuery.includes('閉じる'));
    
    // 追加: タグによるフィルタリング
    let tagFilter = Prisma.sql`TRUE`;
    if (decodedTags && decodedTags.length > 0) {
      const tagArray = decodedTags.split(',').map(t => t.trim());
      if (tagArray.length > 0) {
        const tagConditions = tagArray.map(tag => 
          Prisma.sql`(
            k.main_category ILIKE ${`%${tag}%`} OR 
            k.sub_category ILIKE ${`%${tag}%`} OR 
            k.detail_category ILIKE ${`%${tag}%`}
          )`
        );
        tagFilter = Prisma.sql`(${Prisma.join(tagConditions, ' OR ')})`;
      }
    }
    
    // 4. WHERE 句の構築 - 完全一致、用語条件、カテゴリ条件を OR で結合
    // 修正: 特別なカテゴリ条件は営業時間に関するクエリの場合のみ OR で結合
    const specialCategoryCondition = isBusinessHoursQuery
      ? Prisma.sql`(
          (k.main_category ILIKE '%営業時間%') OR 
          (k.sub_category ILIKE '%営業時間%') OR
          (k.detail_category ILIKE '%営業時間%') OR
          (k.main_category ILIKE '%営業%' AND k.sub_category ILIKE '%時間%') OR
          (k.main_category ILIKE '%営業日%')
        )`
      : Prisma.sql`FALSE`;
    
    // 予約変更関連の特別な条件を追加
    const reservationChangeCondition = isReservationChange
      ? Prisma.sql`(
          (k.main_category ILIKE '%予約%' AND k.sub_category ILIKE '%変更%') OR
          (k.question ILIKE '%予約%変更%') OR
          (k.question ILIKE '%予約%修正%') OR
          (k.question ILIKE '%日程変更%') OR
          (k.question ILIKE '%日時変更%') OR
          (k.id IN (28, 29, 30, 31, 32)) /* 予約変更関連の特定のID */
        )`
      : Prisma.sql`FALSE`;

    // 荷物関連の特別な条件を追加
    const luggageRelatedCondition = isLuggageRelated
      ? Prisma.sql`(
          (k.main_category ILIKE '%送迎%' AND (k.sub_category ILIKE '%荷物%' OR k.sub_category ILIKE '%制限%')) OR
          (k.question ILIKE '%荷物%') OR
          (k.question ILIKE '%スーツケース%') OR
          (k.question ILIKE '%キャリーケース%') OR
          (k.question ILIKE '%トランク%') OR
          (k.id = 48) /* 荷物関連の主要ID */
        )`
      : Prisma.sql`FALSE`;
    
    // ひとり送迎関連の特別な条件を追加
    const soloShuttleCondition = isSoloShuttle
      ? Prisma.sql`(
          (k.sub_category ILIKE '%ひとり送迎%') OR
          (k.question ILIKE '%ひとり送迎%') OR
          (k.answer ILIKE '%ひとり送迎%') OR
          (k.question ILIKE '%6名%') OR
          (k.id IN (170, 172, 173)) /* ひとり送迎関連ID */
        )`
      : Prisma.sql`FALSE`;

    // パターンマッチに対応する条件を追加
    const matchesMultiCar = matchesMultipleCarsPattern(normalizedQuery);
    const multiCarPatternCondition = matchesMultiCar
      ? Prisma.sql`(k.id = 173)` // 複数台・大人数ナレッジ
      : Prisma.sql`FALSE`;

    const matchesWheelchairSolo = matchesWheelchairSoloPattern(normalizedQuery);
    const wheelchairSoloPatternCondition = matchesWheelchairSolo
      ? Prisma.sql`(k.id = 174)` // 車椅子単独ナレッジ
      : Prisma.sql`FALSE`;

    // 修正: 条件名と変数名を変更
    const largeGroupOrMultipleVehicleCondition = isLargeGroupOrMultipleVehicle
      ? Prisma.sql`(k.id = 173)` // 複数台・団体ナレッジを優先
      : Prisma.sql`FALSE`;

    // 追加: アクセス関連の条件を追加
    const accessCondition = isAccess
      ? Prisma.sql`(k.id BETWEEN 100 AND 107 OR k.main_category = 'アクセス')` // アクセス関連IDまたはカテゴリ
      : Prisma.sql`FALSE`;

    // 追加: 満車関連の条件を追加 (主にスコアリングで対応するためWHERE句はシンプルに)
    const fullParkingCondition = isFullParking
      ? Prisma.sql`(k.id = 21 OR k.sub_category = '満車対応')` // ID 21 or 満車対応カテゴリ
      : Prisma.sql`FALSE`;

    const whereClause = Prisma.sql`(${exactMatchCondition} OR ${termConditions} OR ${categoryCondition} OR ${specialCategoryCondition} OR ${reservationChangeCondition} OR ${luggageRelatedCondition} OR ${soloShuttleCondition} OR ${multiCarPatternCondition} OR ${wheelchairSoloPatternCondition} OR ${largeGroupOrMultipleVehicleCondition} OR ${accessCondition} OR ${fullParkingCondition}) AND ${tagFilter}`; // fullParkingCondition を追加
    
    // 5. スコア計算を改善 - 各種マッチングにより異なる重みを設定
    const querySql = Prisma.sql`
      SELECT 
        k.id, k.main_category, k.sub_category, k.detail_category, k.question, k.answer, 
        k.is_template, k.usage, k.note, k.issue, k."createdAt", k."updatedAt",
        pgroonga_score(k.tableoid, k.ctid) * ${WEIGHTS.PGROONGA_MULTIPLIER} AS pgroonga_score,
        
        -- 精度の高いスコア計算
        CASE WHEN k.question ILIKE ${`%${phraseQuery}%`} THEN ${WEIGHTS.EXACT_MATCH} ELSE 0 END AS exact_match_bonus,
        CASE 
          WHEN k.main_category ILIKE ${`%${phraseQuery}%`} OR 
               k.sub_category ILIKE ${`%${phraseQuery}%`} OR 
               k.detail_category ILIKE ${`%${phraseQuery}%`} 
          THEN ${WEIGHTS.CATEGORY_MATCH} 
          ELSE 0 
        END AS category_match_bonus,
        
        -- 修正: 合計スコア計算 - 単語の位置とマッチングタイプも考慮
        (
          pgroonga_score(k.tableoid, k.ctid) * ${WEIGHTS.PGROONGA_MULTIPLIER} +
          -- 完全一致ボーナス（質問文に対する）
          CASE WHEN k.question ILIKE ${`%${phraseQuery}%`} THEN ${WEIGHTS.EXACT_MATCH} ELSE 0 END +
          -- テンプレートボーナス
          CASE WHEN k.is_template = TRUE THEN ${WEIGHTS.IS_TEMPLATE} ELSE 0 END +
          -- カテゴリ一致ボーナス
          CASE 
            WHEN k.main_category ILIKE ${`%${phraseQuery}%`} OR 
                 k.sub_category ILIKE ${`%${phraseQuery}%`} OR 
                 k.detail_category ILIKE ${`%${phraseQuery}%`} 
            THEN ${WEIGHTS.CATEGORY_MATCH} 
            ELSE 0 
          END +
          -- 質問の先頭一致（完全マッチよりさらに高いスコア）
          CASE WHEN k.question ILIKE ${`${phraseQuery}%`} THEN ${WEIGHTS.PHRASE_MATCH} ELSE 0 END +
          -- 質問の類似度に基づくボーナス
          CASE 
            WHEN SIMILARITY(k.question, ${normalizedQuery}) > 0.6 THEN SIMILARITY(k.question, ${normalizedQuery}) * 5.0
            WHEN SIMILARITY(k.question, ${normalizedQuery}) > 0.4 THEN SIMILARITY(k.question, ${normalizedQuery}) * 3.0
            WHEN SIMILARITY(k.question, ${normalizedQuery}) > 0.2 THEN SIMILARITY(k.question, ${normalizedQuery}) * 1.5
            ELSE 0
          END +
          -- 追加: カテゴリに特定の重要単語が含まれる場合、ボーナス
          (CASE WHEN k.main_category ILIKE '%定員%' AND ${normalizedQuery} ILIKE '%定員%' THEN 3.0 ELSE 0 END) +
          (CASE WHEN k.sub_category ILIKE '%定員%' AND ${normalizedQuery} ILIKE '%定員%' THEN 2.5 ELSE 0 END) +
          (CASE WHEN k.main_category ILIKE '%人数%' AND ${normalizedQuery} ILIKE '%人数%' THEN 3.0 ELSE 0 END) +
          (CASE WHEN k.sub_category ILIKE '%人数%' AND ${normalizedQuery} ILIKE '%人数%' THEN 2.5 ELSE 0 END) +
          (CASE WHEN k.main_category ILIKE '%超過%' AND ${normalizedQuery} ILIKE '%超過%' OR ${normalizedQuery} ILIKE '%超える%' THEN 3.0 ELSE 0 END) +
          (CASE WHEN k.sub_category ILIKE '%超過%' AND ${normalizedQuery} ILIKE '%超過%' OR ${normalizedQuery} ILIKE '%超える%' THEN 2.5 ELSE 0 END) +
          (CASE WHEN k.main_category ILIKE '%制限%' AND ${normalizedQuery} ILIKE '%制限%' THEN 1.5 ELSE 0 END) +
          (CASE WHEN k.sub_category ILIKE '%制限%' AND ${normalizedQuery} ILIKE '%制限%' THEN 1.0 ELSE 0 END) +
          -- 修正: 営業時間関連のカテゴリに一致する場合、特別なボーナス（ただし営業時間に関するクエリの場合のみ）
          CASE 
            WHEN ${isBusinessHoursQuery} AND (k.main_category ILIKE '%営業時間%' OR k.sub_category ILIKE '%営業時間%') THEN 2.0
            WHEN ${isBusinessHoursQuery} AND (k.main_category ILIKE '%営業%' AND k.sub_category ILIKE '%時間%') THEN 1.5
            WHEN ${isBusinessHoursQuery} AND (k.main_category ILIKE '%時間%' OR k.sub_category ILIKE '%時間%') THEN 1.0
            WHEN ${isBusinessHoursQuery} AND (k.main_category ILIKE '%営業日%' OR k.sub_category ILIKE '%営業日%') THEN 0.8
            ELSE 0 
          END +
          -- 修正: 営業時間に関する完全一致の場合に特別なボーナス（ただし営業時間に関するクエリの場合のみ）
          CASE WHEN ${businessHoursExactMatch} AND 
                    (k.main_category ILIKE '%営業時間%' OR k.sub_category ILIKE '%営業時間%')
               THEN 5.0 
               ELSE 0 
          END +
          -- 追加: 予約変更関連のカテゴリに一致する場合の特別ボーナス
          CASE
            WHEN ${isReservationChange} AND (k.main_category ILIKE '%予約%' AND k.sub_category ILIKE '%変更%') THEN 5.0
            WHEN ${isReservationChange} AND k.question ILIKE '%予約%変更%' THEN 4.0
            WHEN ${isReservationChange} AND k.question ILIKE '%予約%修正%' THEN 3.5
            WHEN ${isReservationChange} AND k.question ILIKE '%日程変更%' THEN 3.0
            WHEN ${isReservationChange} AND (k.answer ILIKE '%予約%変更%' OR k.answer ILIKE '%予約%修正%') THEN 2.5
            ELSE 0
          END +
          -- 追加: ナレッジ ID に基づく明示的な対応を強化
          CASE
            -- 営業時間のナレッジ (ID 113) に関する特別なスコア処理
            WHEN k.id = 113 THEN
              CASE 
                WHEN ${isBusinessHoursQuery} THEN 15.0  -- 営業時間関連クエリの場合は高いスコア
                ELSE -10.0  -- 非営業時間クエリでは大幅減点 (基本的に表示されないようにする)
              END
            -- 他の重要ナレッジに対する特別処理
            WHEN (k.id = 62 OR k.id = 63) AND 
                 (${normalizedQuery} ILIKE '%定員%' OR ${normalizedQuery} ILIKE '%人数%' OR 
                  ${normalizedQuery} ILIKE '%超える%' OR ${normalizedQuery} ILIKE '%超過%') 
            THEN 15.0
            -- 予約変更関連のナレッジに対する特別処理
            WHEN (k.id IN (28, 29, 30, 31, 32)) AND ${isReservationChange} THEN 12.0
            ELSE 0
          END +
          -- 追加: 荷物関連のボーナススコア
          CASE
            WHEN (k.id = 48) AND ${isLuggageRelatedQuery(normalizedQuery)} THEN 12.0
            ELSE 0
          END +
          -- 追加: ひとり送迎関連のボーナススコア
          CASE
            WHEN ${isSoloShuttle} AND k.sub_category ILIKE '%ひとり送迎%' THEN 6.0
            WHEN ${isSoloShuttle} AND k.question ILIKE '%ひとり送迎%' THEN 5.0
            WHEN ${isSoloShuttle} AND (k.question ILIKE '%6名%' OR k.answer ILIKE '%6名%') THEN 4.0
            ELSE 0
          END +
          -- 追加: パターンマッチのボーナススコア
          CASE
            WHEN ${matchesMultiCar} AND k.id = 173 THEN 15.0 -- パターン一致は高スコア (SQLコメントに修正)
            WHEN ${matchesWheelchairSolo} AND k.id = 174 THEN 15.0 -- パターン一致は高スコア (SQLコメントに修正)
            ELSE 0
          END +
          -- 修正: 複数台/団体クエリの特別処理 (変数名を変更)
          CASE
            WHEN ${isLargeGroupOrMultipleVehicle} AND k.id = 173 THEN 15.0 -- 複数台/団体クエリでID 173を優先
            ELSE 0
          END +
          -- 追加: アクセス関連クエリのボーナススコア (IDベース)
          CASE
            WHEN ${isAccess} AND k.id BETWEEN 100 AND 107 THEN 20.0 -- アクセスクエリでID 100-107を高スコアに
            WHEN ${isAccess} AND k.main_category = 'アクセス' THEN 5.0 -- アクセスカテゴリにもボーナス
            ELSE 0
          END +
          -- 追加: 満車関連クエリのボーナススコア (ID 21特化)
          CASE
            WHEN ${isFullParking} AND k.id = 21 THEN 25.0 -- 満車クエリでID 21を最優先
            WHEN ${isFullParking} AND k.sub_category = '満車対応' THEN 10.0 -- 満車対応カテゴリもブースト
            ELSE 0
          END +
          -- ナレッジIDに基づく明示的な対応を強化 (CASE文を追加)
          CASE
            -- ひとり送迎関連のナレッジに対する特別処理
            WHEN (k.id IN (169, 170, 171, 172, 173)) AND ${isSoloShuttle} THEN 10.0
            -- 車椅子関連のナレッジに対する特別処理 (条件を修正)
            WHEN (k.id = 174) AND (${matchesWheelchairSolo} OR ${isWheelchairQuery(normalizedQuery)}) THEN 10.0 -- クエリが車椅子関連の場合のみブースト
            ELSE 0 -- ELSE句を追加
          END -- CASEを終了
        ) AS adjusted_score
        
      FROM "Knowledge" k
      WHERE ${whereClause}
      
      -- 結果の並べ替えを改善
      ORDER BY 
        adjusted_score DESC,
        pgroonga_score DESC
      LIMIT 20
    `;

    console.log('[DEBUG] Executing Improved PGroonga Query');

    const results = await prisma.$queryRaw<KnowledgeWithScore[]>(querySql);

    console.log(`PGroonga検索結果: ${results.length}件`);

    // 6. スコアの正規化・フィルタリング・変換
    const searchResults: SearchResult[] = results
      .map(result => {
        // スコアを計算（最低でも0.1を確保）
        const calculatedScore = Math.max(0.1, result.adjusted_score || result.pgroonga_score || 0);
        
        // テンプレートであれば加算
        const templateBonus = result.is_template ? 0.2 : 0;
        
        // 修正: 最終スコアの計算 - 類似度に基づく補正
        let finalScore = calculatedScore + templateBonus;
        
        // 追加: 質問の長さの類似度を考慮 (極端に長さが異なると減点)
        if (result.question) {
          // 1. 基本的な長さの類似度
          const queryLength = normalizedQuery.length;
          const resultLength = result.question.length;
          const lengthRatio = Math.min(queryLength, resultLength) / Math.max(queryLength, resultLength);
          
          // 長さの比率が0.5未満は類似度が低いため、スコアを下げる
          if (lengthRatio < 0.5) {
            finalScore *= (0.7 + (lengthRatio * 0.6)); // 0.5未満なら最大30%減点
          }
          
          // 2. カテゴリがクエリに関連している場合、スコアを上げる
          const mainCategoryBonus = result.main_category && 
            finalSearchTerms.some(term => result.main_category!.toLowerCase().includes(term.toLowerCase())) ? 0.5 : 0;
          
          const subCategoryBonus = result.sub_category && 
            finalSearchTerms.some(term => result.sub_category!.toLowerCase().includes(term.toLowerCase())) ? 0.3 : 0;
          
          // 3. 質問に出現する単語の数と共通単語の割合を考慮
          const questionWords = result.question.toLowerCase().split(/\s+|、|。/);
          const commonWordCount = finalSearchTerms.filter(term => 
            questionWords.some(word => word.includes(term.toLowerCase()))
          ).length;
          
          const matchRatio = commonWordCount / Math.max(1, finalSearchTerms.length);
          const wordMatchBonus = matchRatio > 0.5 ? matchRatio * 1.0 : 0;
          
          // 4. カテゴリの特殊ケース処理
          // "利用制限"カテゴリは幅広いため、より具体的なサブカテゴリをチェック
          if (result.main_category === '利用制限') {
            // クエリに「定員」または「人数」が含まれている場合、
            // サブカテゴリに「制限」や「対象」だけでなく「定員」や「人数」も含まれているか確認
            if ((normalizedQuery.includes('定員') || normalizedQuery.includes('人数')) && 
                result.sub_category && 
                !(result.sub_category.includes('定員') || result.sub_category.includes('人数'))) {
              finalScore *= 0.5; // 50%減点
            }
            
            // クエリに「外車」や「国際線」が含まれている場合はそれらの回答を優先
            if ((normalizedQuery.includes('外車') || normalizedQuery.includes('国際')) && 
                result.sub_category && 
                (result.sub_category.includes('保険対象') || result.sub_category.includes('利用範囲'))) {
              finalScore *= 1.5; // 50%加点
            } else if (!(normalizedQuery.includes('外車') || normalizedQuery.includes('国際')) && 
                      result.sub_category && 
                      (result.sub_category.includes('保険対象') || result.sub_category.includes('利用範囲'))) {
              finalScore *= 0.7; // 30%減点
            }
          }
          
          // 追加: 特定のクエリパターンに対するカテゴリマッチングボーナス
          for (const [queryPattern, categories] of Object.entries(CATEGORY_QUERY_MAPPING)) {
            if (normalizedQuery.includes(queryPattern)) {
              // このパターンがクエリに含まれている場合、関連カテゴリがマッチするか確認
              const categoryMatches = categories.some(category => 
                (result.main_category && result.main_category.includes(category)) || 
                (result.sub_category && result.sub_category.includes(category)) || 
                (result.detail_category && result.detail_category.includes(category))
              );
              
              if (categoryMatches) {
                // 追加: 「定員を超える人数」に特に関連するカテゴリに高いボーナス
                if ((queryPattern === '定員' || queryPattern === '人数' || queryPattern === '超える' || queryPattern === '超過') && 
                    (normalizedQuery.includes('定員') && normalizedQuery.includes('人数') || 
                     normalizedQuery.includes('超える') || normalizedQuery.includes('超過'))) {
                  finalScore *= 1.8; // 特に重要なケースは80%増加
                  // さらに「送迎関連 > 制限事項 > 定員」の完全一致には特別ボーナス
                  if (result.main_category === '送迎関連' && 
                      (result.sub_category === '制限事項' || result.sub_category === '制限事項') && 
                      (result.detail_category === '定員' || result.detail_category === '人数制限')) {
                    finalScore *= 1.5; // さらに50%増加
                  }
                } 
                // 追加: 予約変更関連のクエリパターンの特別処理
                else if ((queryPattern === '予約変更' || queryPattern === '変更' || queryPattern === '日程変更' || queryPattern === '日時変更') && 
                          isReservationChange) {
                  finalScore *= 2.0; // 予約変更関連は100%増加
                  // さらに「予約関連 > 変更」の完全一致には特別ボーナス
                  if (result.main_category === '予約関連' && 
                      (result.sub_category === '変更' || result.sub_category?.includes('変更'))) {
                    finalScore *= 1.8; // さらに80%増加
                  }
                  // 特定の予約変更関連IDに対する特別ボーナス
                  if ([28, 29, 30, 31, 32].includes(result.id)) {
                    finalScore *= 2.5; // 特定のIDは150%増加
                  }
                }
                else {
                  finalScore *= 1.3; // 通常のカテゴリマッチは30%増加
                }
              }
            }
          }
          
          // 追加: 予約変更関連の特別処理
          if (isReservationChange) {
            // 予約関連 > 変更 カテゴリに高いボーナス
            if (result.main_category === '予約関連' && 
                (result.sub_category === '変更' || result.sub_category?.includes('変更'))) {
              finalScore *= 3.0; // 200%増加
            }
            
            // 質問文に「予約」と「変更」の両方を含む場合
            if (result.question && 
                ((result.question.includes('予約') && result.question.includes('変更')) || 
                 result.question.includes('予約変更') || 
                 result.question.includes('日程変更') || 
                 result.question.includes('日時変更'))) {
              finalScore *= 2.5; // 150%増加
            }
            
            // 特定のID（予約変更関連）への特別処理
            if ([28, 29, 30, 31, 32].includes(result.id)) {
              finalScore *= 3.5; // 最優先 - 250%増加
              finalScore += 5.0; // 固定値でさらに5点加算
            }
          }
          
          // 追加: 荷物関連の特別処理
          if (isLuggageRelated) {
            // 送迎関連 > 荷物制限 カテゴリに高いボーナス
            if (result.main_category === '送迎関連' && 
                (result.sub_category === '荷物制限' || result.sub_category?.includes('荷物') || result.sub_category?.includes('制限'))) {
              finalScore *= 3.0; // 200%増加
            }
            
            // 質問文に「荷物」と「制限/サイズ/大きさ」の両方を含む場合
            if (result.question && 
                ((result.question.includes('荷物') && 
                  (result.question.includes('制限') || result.question.includes('サイズ') || result.question.includes('大きさ'))) || 
                 result.question.includes('大きな荷物') || 
                 result.question.includes('スーツケース'))) {
              finalScore *= 2.5; // 150%増加
            }
            
            // 特定のID（荷物関連）への特別処理
            if ([48].includes(result.id)) { // IDを48に修正
              finalScore *= 3.5; // 最優先 - 250%増加
              finalScore += 5.0; // 固定値でさらに5点加算
              // さらに、スーツケースの個数に関するクエリであれば特別ボーナス
              if (normalizedQuery.includes('スーツケース') && 
                  (normalizedQuery.includes('何個') || normalizedQuery.includes('いくつ') || normalizedQuery.includes('個数'))) {
                finalScore *= 1.5; // 50%追加ブースト
              }
            }
          }
          
          // 追加: ひとり送迎関連の特別処理
          if (isSoloShuttle) {
            if (result.sub_category === 'ひとり送迎') {
              finalScore *= 2.5; // 150%増加
            }
            if ([170, 172, 173].includes(result.id)) {
              finalScore *= 1.5; // 関連IDは50%増加
            }
          }
          
          // 追加: パターンマッチの特別処理
          if (matchesMultiCar && result.id === 173) {
              finalScore *= 4.0; // パターン一致は最優先 (300%増加)
              finalScore += 10.0; // 固定値ボーナス
          }
          // 修正: 複数台/団体クエリの特別処理 (変数名を変更)
          if (isLargeGroupOrMultipleVehicle && result.id === 173) {
              finalScore *= 3.5; // 複数台/団体クエリでID 173を優先 (250%増加)
              finalScore += 8.0;  // 固定値ボーナス
          }
          if (matchesWheelchairSolo && result.id === 174) {
              finalScore *= 4.0; // パターン一致は最優先 (300%増加)
              finalScore += 10.0; // 固定値ボーナス
          }
          
          // 追加: 車椅子クエリの特別処理 (ID 174 以外も考慮する場合)
          if (isWheelchairQuery(normalizedQuery) && result.id === 174) {
              finalScore *= 2.0; // 車椅子クエリでID 174をブースト (100%増加)
              finalScore += 5.0;
          }
          
          // 追加: アクセス関連クエリの特別処理
          if (isAccess && result.id >= 100 && result.id <= 107) {
              finalScore *= 3.0; // アクセスクエリでID 100-107を優先 (200%増加)
              finalScore += 15.0; // 固定値ボーナス
          }
          
          finalScore += mainCategoryBonus + subCategoryBonus + wordMatchBonus;
        }
        
        // 追加: 回答とクエリの類似度もスコアに加味
        if (result.answer) {
          // const answerSimilarity = calculateStringSimilarity(result.answer, normalizedQuery); // 例: 類似度計算関数を呼び出す
          // 仮の類似度計算 (部分一致で簡易的に評価)
          let answerMatchScore = 0;
          const answerWords = result.answer.toLowerCase().split(/\s+|、|。/);
          const commonAnswerWordCount = finalSearchTerms.filter(term =>
            answerWords.some(word => word.includes(term.toLowerCase()))
          ).length;
          const answerMatchRatio = commonAnswerWordCount / Math.max(1, finalSearchTerms.length);
          if (answerMatchRatio > 0.3) { // 30%以上の単語が一致したら加点
            answerMatchScore = answerMatchRatio * 1.5;
          }

          if (answerMatchScore > 0) {
            finalScore += answerMatchScore; // 類似度に応じてスコアを追加
          }
        }
        
        return {
          ...result,
          // スコアを設定
          score: finalScore,
          // デバッグ情報を付与
          note: `${result.note || ''} (Base: ${result.pgroonga_score.toFixed(2)}, Adj: ${result.adjusted_score.toFixed(2)}, Final: ${finalScore.toFixed(2)})`
        };
      })
      // スコアでソート
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      // 最小スコアでフィルタリング
      .filter(result => result.score > MIN_SCORE_THRESHOLD);

    // デバッグログ
    console.log('検索結果 (上位5件):', searchResults.slice(0, 5).map(r => ({ 
      id: r.id, 
      q: r.question?.substring(0, 30) + '...', 
      score: (r.score || 0).toFixed(2),
      category: r.main_category
    })));

    // 追加: 検索時間を計算しメトリクスを更新
    const searchTime = Date.now() - searchStartTime;
    updateMetrics(searchTime);
    console.log(`検索時間: ${searchTime}ms`);
    
    // 追加: 結果をキャッシュに保存
    saveToCache(normalizedQuery, decodedTags, searchResults);

    return searchResults;

  } catch (error) {
    console.error('検索エラー:', error);
    // PGroongaが失敗した場合はシンプルな検索にフォールバック
    const fallbackResults = await simpleSearch(normalizedQuery, finalSearchTerms);
    
    // 追加: 検索時間を計算しメトリクスを更新
    const searchTime = Date.now() - searchStartTime;
    updateMetrics(searchTime);
    
    // 追加: フォールバック結果もキャッシュに保存
    saveToCache(normalizedQuery, decodedTags, fallbackResults);
    
    return fallbackResults;
  }
}

/**
 * シンプルな検索フォールバック関数 - メイン検索が失敗した場合に使用
 */
async function simpleSearch(query: string, terms: string[]): Promise<SearchResult[]> {
  console.log('シンプル検索を実行します...');
  
  type InsensitiveMode = 'insensitive';
  
  try {
    // 修正: 改善されたLIKE検索
    const results = await prisma.knowledge.findMany({
      where: {
        OR: [
          // 完全一致検索 (最も重要)
          { question: { equals: query, mode: 'insensitive' as InsensitiveMode } },
          // 部分一致検索 (それなりに重要)
          { question: { contains: query, mode: 'insensitive' as InsensitiveMode } },
          { answer: { contains: query, mode: 'insensitive' as InsensitiveMode } },
          // 先頭一致検索 (かなり重要)
          { question: { startsWith: query, mode: 'insensitive' as InsensitiveMode } },
          // 単語検索 (補完的)
          ...terms.map(term => ({ 
            OR: [
              { question: { contains: term, mode: 'insensitive' as InsensitiveMode } },
              { answer: { contains: term, mode: 'insensitive' as InsensitiveMode } },
              { main_category: { contains: term, mode: 'insensitive' as InsensitiveMode } },
              { sub_category: { contains: term, mode: 'insensitive' as InsensitiveMode } }
            ] 
          }))
        ]
      },
      select: selectKnowledgeFields,
      take: 15
    });
    
    // 修正: 改善されたスコアリング
    return results.map(r => {
      // ベーススコア
      let score = 0.3;
      
      // 完全一致は最高スコア
      if (r.question?.toLowerCase() === query.toLowerCase()) {
        score = 3.0;
      }
      // 質問の先頭に含まれる場合
      else if (r.question?.toLowerCase().startsWith(query.toLowerCase())) {
        score = 2.0;
      }
      // 質問に含まれる場合
      else if (r.question?.toLowerCase().includes(query.toLowerCase())) {
        score = 1.5;
      }
      // 回答に含まれる場合
      else if (r.answer?.toLowerCase().includes(query.toLowerCase())) {
        score = 1.0;
      }
      // カテゴリに含まれる場合
      else if (
        r.main_category?.toLowerCase().includes(query.toLowerCase()) ||
        r.sub_category?.toLowerCase().includes(query.toLowerCase()) ||
        r.detail_category?.toLowerCase().includes(query.toLowerCase())
      ) {
        score = 0.8;
      }
      
      // テンプレート加点
      if (r.is_template) {
        score += 0.2;
      }
      
      return { 
        ...r, 
        score,
        note: 'シンプル検索結果 (スコア: ' + score.toFixed(2) + ')' 
      };
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0)); // スコアでソート
  } catch (fallbackError) {
    console.error('シンプル検索エラー:', fallbackError);
    return [];
  }
}

// 追加: キャッシュをクリアする関数（外部公開）
export function clearSearchCache(): void {
  searchCache.length = 0;
  console.log('検索キャッシュをクリアしました');
}

export type { SearchResult, SearchMetrics };

// CommonJSのmodule.exportsも追加
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { searchKnowledge, getSearchMetrics, clearSearchCache, isLargeGroupOrMultipleVehicleQuery, isWheelchairQuery, isAccessQuery, isFullParkingQuery };
}