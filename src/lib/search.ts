// 必要なモジュールのインポート
import { PrismaClient, Prisma } from '@prisma/client';
import { searchKnowledgeByTags } from './tag-search';
import { prisma } from './db';

// 新しいモジュールをインポート
import { enhancedPreprocessQuery } from './query-processor';
import { calculateScore, addSearchNotes } from './scoring';
import { 
  searchLuxuryCarParking, 
  searchReservationChange, 
  searchInternationalFlight
} from './special-topic-search';

// 共通型をインポート
import { SearchResult } from './common-types';

import { Knowledge, SeasonalInfo } from '@prisma/client';
import { extractDatesFromText, checkBusyPeriods, formatDateToJapanese } from './date-utils';

// Prismaクライアントのインスタンスを作成
const prismaClient = new PrismaClient();

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
    orQuery = searchTerms.map(term => `${term}`).join(' | ');
    
    // AND検索用クエリ（完全一致）
    andQuery = searchTerms.map(term => `${term}`).join(' & ');
    
    // プレーンテキスト検索用クエリ
    plainQuery = searchTerms.join(' | ');
  } else if (searchTerms.length === 1) {
    plainQuery = searchTerms[0];
    orQuery = searchTerms[0];
    andQuery = searchTerms[0];
  }
  
  // ステップ5: PGroonga検索用のクエリを作成
  // 注意: PGroongaは独自の構文を持っています
  const webSearchQuery = searchTerms.join(' OR ');
  
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
    // 予約関連のパターンを強化
    /予約|キャンセル|変更|修正|更新|訂正|手続|手順|方法/,
    /料金|支払|駐車|送迎|車種|サイズ|営業|時間/,
    /オンライン|インターネット|ウェブ|スマホ|アプリ/,
    /国際線|国内線|到着|出発|帰国|出国/,
    /混雑|繁忙|ピーク|満車|空き/,
    /クレジット|カード|現金|電子|マネー/,
    /領収書|レシート|明細|証明書/,
    /割引|クーポン|ディスカウント|特典/,
    /精算|会計|決済|支払い/
  ];

  // 予約変更関連の特別パターン（より広範囲なパターンをカバー）
  const reservationChangePatterns = [
    /予約.*変更|予約.*修正|予約.*更新|予約.*訂正/,
    /変更.*予約|修正.*予約|更新.*予約|訂正.*予約/,
    /予約内容.*変更|予約.*内容.*変更/,
    /予約日程.*変更|予約日.*変更|予約時間.*変更/,
    /送迎.*変更|車種.*変更|利用便.*変更|日付.*変更/,
    /変更方法|変更手続き|変更手順|変更可能|変更できる/,
    /日程変更|時間変更|内容変更|予約変|変予約|予変更/,
  ];

  // 文字列を分割（助詞や句読点で区切る）
  const segments = text.split(/[はがのにへでとやもを、。．！？!?.\s]+/).filter(Boolean);
  
  // 予約変更関連の複合語を抽出（高優先度）
  const reservationChangeCompounds = [];
  // 3単語までの複合語を検出
  for (let i = 0; i < segments.length - 2; i++) {
    for (let j = 1; j <= 3; j++) {
      if (i + j < segments.length) {
        const compound = segments.slice(i, i + j + 1).join('');
        if (compound.length >= 3 && compound.length <= 15) {
          if (reservationChangePatterns.some(pattern => pattern.test(compound))) {
            reservationChangeCompounds.push(compound);
          }
        }
      }
    }
  }
  
  // 重要な用語を抽出
  const terms = segments
    .filter(term => term.length >= 1)
    .filter(term => !commonStopwords.includes(term))
    .filter(term => !/^\d+$/.test(term) || /\d+[月日時分]|\d+:\d+/.test(term));

  // 重要なパターンにマッチする単語を優先
  const importantTerms = terms.filter(term => 
    importantPatterns.some(pattern => pattern.test(term))
  );

  // 予約変更関連の特別パターンにマッチする単語を追加
  const reservationChangeTerms = terms.filter(term => 
    reservationChangePatterns.some(pattern => pattern.test(term))
  );
  
  // 元の複合語の処理
  const compounds = [];
  for (let i = 0; i < segments.length - 1; i++) {
    const compound = segments[i] + segments[i + 1];
    if (compound.length >= 3 && compound.length <= 10) {
      // 予約変更関連の複合語を優先
      if (reservationChangePatterns.some(pattern => pattern.test(compound))) {
        compounds.unshift(compound);
      } else if (importantPatterns.some(pattern => pattern.test(compound))) {
        compounds.push(compound);
      }
    }
  }

  // "予約変更"が含まれるか確認し、含まれていれば最優先で追加
  if (text.includes('予約変更') || text.includes('予約の変更') || text.includes('予約内容を変更')) {
    reservationChangeTerms.unshift('予約変更');
  }

  // 結果を結合して重複を除去（予約変更関連の用語を優先）
  const allTerms = [...new Set([
    ...reservationChangeCompounds,
    ...reservationChangeTerms, 
    ...importantTerms, 
    ...compounds, 
    ...terms
  ])];
  
  return allTerms.slice(0, 20);
}

/**
 * 特別な重要キーワードを抽出する関数
 * "オンライン" "駐車場"などの特定の重要単語を検出
 */
function extractSpecialTerms(text: string): string[] {
  // 最重要キーワード（特別な処理が必要なもの）
  const specialKeywords = [
    // 既存のキーワード
    'オンライン', '駐車場', '予約', 'キャンセル', '料金', '支払い', '送迎', '車種', 'サイズ',
    '国際線', 'インターナショナル', '朝帰国', 'レクサス', '外車', 'BMW', 'ベンツ', 'アウディ',
    '満車', '空き', '定員', '人数', '繁忙期', '混雑', 'ピーク',
    // 追加するキーワード
    '営業時間', '営業', '開店', '閉店', '営業日', '休業日', '深夜', '24時間',
    '何時から', '何時まで', '利用時間', '駐車時間', '営業開始', '営業終了',
    '領収書', 'レシート', '明細', '証明書',
    '割引', 'クーポン', 'ディスカウント', '特典',
    '精算', '会計', '決済', 'カード', '現金', '電子マネー',
    '解約', '取り消し', '返金',
    // 予約変更関連のキーワード（優先度アップ）
    '予約変更', '予約の変更', '予約内容の変更', '予約の修正',
    '予約の更新', '予約の訂正', '予約の修正方法', '予約の変更手続き',
    '送迎変更', '車種変更', '利用便変更', '日付変更', '時間変更',
    '変更方法', '変更手続き', '変更手順', '変更可能', '変更できる',
    '予約日程変更', '予約日変更', '予約時間変更',
    // 外車・大型車関連のキーワード（追加）
    '大型車', '外車', '大型車両', '大型', '輸入車', '高級車', '大型高級車',
    '外国産', '輸入自動車', '大型サイズ', '大型料金', 'サイズ超過', '車両サイズ'
  ];
  
  const foundTerms: string[] = [];
  
  // 最重要キーワードの検出（優先）
  specialKeywords.forEach(keyword => {
    if (text.includes(keyword)) {
      // 外車関連のキーワードを先頭に追加
      if (keyword === '外車' || keyword === '輸入車' || keyword === 'BMW' || keyword === 'ベンツ' || keyword === 'アウディ') {
        foundTerms.unshift(keyword);
      } 
      // 大型車関連のキーワードを優先
      else if (keyword === '大型車' || keyword === '大型車両' || keyword === '大型サイズ' || keyword === 'サイズ超過') {
        foundTerms.unshift(keyword);
      }
      // 予約変更関連のキーワードを先頭に追加
      else if (keyword.includes('予約') && keyword.includes('変更')) {
        foundTerms.unshift(keyword);
      } else {
        foundTerms.push(keyword);
      }
    }
  });
  
  // 複合キーワードの検出
  if (text.includes('国際線') && (text.includes('利用') || text.includes('使え') || text.includes('使用') || text.includes('可能'))) {
    foundTerms.push('国際線利用');
  }
  
  // キャンセル関連の複合キーワード検出
  if (text.includes('キャンセル') && (text.includes('ルール') || text.includes('規約') || text.includes('規則') || text.includes('ポリシー'))) {
    foundTerms.push('キャンセルルール');
  }
  
  if (text.includes('キャンセル') && (text.includes('料金') || text.includes('料') || text.includes('費用'))) {
    foundTerms.push('キャンセル料');
  }
  
  if (text.includes('予約') && text.includes('キャンセル')) {
    foundTerms.push('予約キャンセル');
  }
  
  // 予約変更関連の複合キーワード検出（より広範なパターンをカバー）
  if (text.includes('予約') && (text.includes('変更') || text.includes('修正') || text.includes('更新') || text.includes('訂正'))) {
    foundTerms.unshift('予約変更');
  }
  
  if (text.includes('予約内容') && text.includes('変更')) {
    foundTerms.unshift('予約内容変更');
  }
  
  if (text.includes('予約日程') && text.includes('変更')) {
    foundTerms.unshift('予約日程変更');
  }
  
  if (text.includes('送迎') && text.includes('変更')) {
    foundTerms.unshift('送迎変更');
  }
  
  if (text.includes('車種') && text.includes('変更')) {
    foundTerms.unshift('車種変更');
  }
  
  if (text.includes('利用便') && text.includes('変更')) {
    foundTerms.unshift('利用便変更');
  }
  
  if (text.includes('日付') && text.includes('変更')) {
    foundTerms.unshift('日付変更');
  }
  
  if (text.includes('時間') && text.includes('変更')) {
    foundTerms.unshift('時間変更');
  }
  
  // 変更方法に関する検出
  if (text.includes('変更') && (text.includes('方法') || text.includes('手続き') || text.includes('手順'))) {
    foundTerms.unshift('変更方法');
  }
  
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
  
  // 予約変更に関する単語があれば「予約変更」カテゴリを追加
  if (terms.some(term => /予約.*変更|予約.*修正|予約.*更新|予約.*訂正|送迎変更|車種変更|利用便変更|日付変更/.test(term))) {
    boostedTerms.push('予約変更');
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

// 検索結果のスコアリングを更新
function calculateSearchScore(
  tsScore: number,
  simScore: number,
  tagScore: number,
  categoryScore: number,
  keyTerms: string[] = []
): number {
  // 予約変更関連のキーワードを検出
  const hasReservationChangeTerms = keyTerms.some(term => 
    /予約.*変更|予約.*修正|変更.*予約|修正.*予約|予約内容.*変更|予約の変更/.test(term) ||
    term === '予約変更' || term === '予約日程変更' || term === '予約の変更'
  );
  
  // 重み付け係数
  let tsWeight = 0.4;      // 全文検索スコア（40%）
  let simWeight = 0.2;     // 類似度スコア（20%）
  let tagWeight = 0.2;     // タグスコア（20%）
  let categoryWeight = 0.2; // カテゴリスコア（20%）
  
  // 予約変更関連のクエリの場合、カテゴリスコアの重み付けを増加
  if (hasReservationChangeTerms) {
    tsWeight = 0.3;        // 全文検索スコア（30%）
    simWeight = 0.2;       // 類似度スコア（20%）
    tagWeight = 0.2;       // タグスコア（20%）
    categoryWeight = 0.3;  // カテゴリスコア（30%）
  }
  
  return (
    (tsScore * tsWeight) +
    (simScore * simWeight) +
    (tagScore * tagWeight) +
    (categoryScore * categoryWeight)
  );
}

/**
 * カテゴリスコアを計算する関数
 * 
 * @param knowledge ナレッジエントリ
 * @param query 検索クエリ
 * @param tags 検索タグ
 * @returns カテゴリスコア（0.0〜1.0）
 */
function calculateCategoryScore(
  knowledge: Knowledge,
  query: string,
  tags: string[]
): number {
  let score = 0;
  
  // カテゴリ一致スコア
  if (
    knowledge.main_category &&
    query.toLowerCase().includes(knowledge.main_category.toLowerCase())
  ) {
    score += 0.3;
  }
  
  if (
    knowledge.sub_category &&
    query.toLowerCase().includes(knowledge.sub_category.toLowerCase())
  ) {
    score += 0.2;
  }
  
  // 予約変更に関する特別スコアリング
  if (
    query.includes('予約') &&
    query.includes('変更') &&
    (knowledge.question?.includes('予約') || knowledge.question?.includes('変更'))
  ) {
    score += 0.3;
  }
  
  // 検索タグが指定されている場合はボーナススコア
  if (tags.length > 0 && knowledge.main_category) {
    for (const tag of tags) {
      if (knowledge.main_category.includes(tag)) {
        score += 0.2;
      }
    }
  }
  
  return Math.min(score, 1);
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

// 重要な利用規約キーワードの定義
const IMPORTANT_TERMS = {
  INTERNATIONAL_FLIGHT: {
    keywords: ['国際線', '国際便', '国際'],
    weight: 1.5,
    category: '利用制限'
  },
  VEHICLE_RESTRICTIONS: {
    keywords: ['外車', 'レクサス', '大型高級車', '高級車', 'BMW', 'ベンツ', 'アウディ'],
    weight: 1.3,
    category: '利用制限'
  },
  LUGGAGE_RESTRICTIONS: {
    keywords: ['荷物', '手荷物', 'バッグ', 'スーツケース', '定員'],
    weight: 1.2,
    category: '利用制限'
  },
  PASSENGER_LIMIT: {
    keywords: ['定員', '人数制限', '乗車人数', '利用人数', '5名'],
    weight: 1.4,
    category: '利用制限'
  }
};

// 検索クエリの前処理を簡素化
function enhanceQueryPreprocessing(query: string): string {
  // 基本的なクエリの正規化
  const normalizedQuery = query.trim();
  
  // 重要なキーワードの追加
  let enhancedQuery = normalizedQuery;
  
  // 重要な利用規約キーワードの検出と重み付け
  Object.values(IMPORTANT_TERMS).forEach(term => {
    if (term.keywords.some(keyword => normalizedQuery.includes(keyword))) {
      // 検出されたキーワードを追加
      enhancedQuery += ' ' + term.keywords.join(' ');
    }
  });
  
  console.log('Original Query:', query);
  console.log('Enhanced Query:', enhancedQuery);
  
  return enhancedQuery;
}

/**
 * 検索クエリを前処理する関数（改善版）
 */
function preprocessQuery(query: string): string {
  // 不要な助詞や記号を削除
  const normalized = query.replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割して重要なキーワードを抽出
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // 「予約」「営業時間」などの重要キーワードを抽出
  const keywords = [];
  for (const word of words) {
    // 外車関連の抽出強化
    if (word.includes('外車') || word === '外車' || word.includes('外国車') || word.includes('輸入車')) {
      keywords.push('外車');
      // 高級車・大型車関連のキーワードも追加
      keywords.push('高級車');
      keywords.push('大型車');
    }
    
    // 予約関連
    if (word.includes('予約')) keywords.push('予約');
    if (word.includes('変更') && (normalized.includes('予約') || normalized.includes('変更'))) {
      keywords.push('予約変更');
      keywords.push('変更');
    }
    
    // その他重要キーワード
    if (word.includes('営業')) keywords.push('営業');
    if (word.includes('時間')) keywords.push('時間');
    if (word.includes('国際')) keywords.push('国際');
    if (word.includes('キャンセル')) keywords.push('キャンセル');
    if (word.includes('料金')) keywords.push('料金');
    if (word.includes('支払')) keywords.push('支払');
    if (word.includes('修正')) keywords.push('修正');
    if (word.includes('更新')) keywords.push('更新');
    if (word.includes('送迎')) keywords.push('送迎');
  }
  
  // 「外車」と「駐車」が両方含まれている場合に特別な複合語を追加
  if (normalized.includes('外車') && normalized.includes('駐車')) {
    keywords.push('外車駐車');
    keywords.push('外車や大型高級車でも駐車場を利用');
  }
  
  // 国際線関連のクエリの場合
  if (normalized.includes('国際線') || (normalized.includes('国際') && normalized.includes('線'))) {
    keywords.push('国際線');
    if (normalized.includes('利用') || normalized.includes('可能')) {
      keywords.push('国際線の利用');
      keywords.push('国際線をご利用');
    }
  }
  
  // 文字列から漢字、ひらがな、カタカナの部分を抽出
  const japanesePattern = /[一-龠]+|[ぁ-ゔ]+|[ァ-ヴー]+/g;
  const japaneseMatches = normalized.match(japanesePattern) || [];
  
  // クエリと分割したものと抽出したキーワードをすべて含める
  const allTerms = [
    normalized, // 元のクエリそのままも含める
    ...words,
    ...keywords,
    ...japaneseMatches
  ];
  
  // ユニークなキーワードを返す（重複を排除）
  return [...new Set(allTerms)].join(' ');
}

/**
 * 知識ベースを検索する関数（改善版）
 * 
 * @param query 検索クエリ
 * @param tags タグ（オプション）
 * @param category カテゴリ（オプション）
 * @returns 検索結果の配列
 */
export async function searchKnowledge(
  query: string,
  tags: string[] = [],
  category: string = ''
): Promise<SearchResult[]> {
  // ★★★ 関数の入り口にログを追加 ★★★
  console.log(`--- searchKnowledge called with query: "${query}", tags: [${tags.join(', ')}], category: "${category}" ---`);
  console.log(`検索クエリ: "${query}"`);

  try {
    // データベース内のKnowledgeエントリの総数をログ
    const knowledgeCount = await prisma.knowledge.count();
    console.log(`データベース内のKnowledgeエントリ数: ${knowledgeCount}`);
    
    // 元のクエリを保存
    const originalQuery = query.trim();
    
    // クエリの前処理（標準と拡張の両方を実行）
    const standardProcessedQuery = preprocessQuery(originalQuery);
    const enhancedProcessedQuery = enhancedPreprocessQuery(originalQuery);
    
    console.log(`標準前処理済みクエリ: "${standardProcessedQuery}"`);
    console.log(`拡張前処理済みクエリ: "${enhancedProcessedQuery}"`);
    
    let results: SearchResult[] = [];
    
    // ★★★ if 文の直前にログを追加 ★★★
    console.log(`--- Checking for Reservation Change search trigger for query: "${originalQuery}" ---`);
    // 予約変更関連の専用検索（新規追加）
    if (originalQuery.includes('予約変更') || 
        (originalQuery.includes('予約') && 
          (originalQuery.includes('変更') || originalQuery.includes('修正') || 
           originalQuery.includes('キャンセル')))) {
      console.log('予約変更関連のクエリを検出しました');

      try {
        // 予約変更関連のナレッジを直接検索
        console.log('>>> 予約変更検索: 予約変更関連のナレッジを検索します');
        
        const reservationChangeKnowledge = await prisma.knowledge.findMany({
          where: {
            AND: [
              {
                OR: [
                  { question: { contains: '予約' } },
                  { answer: { contains: '予約' } },
                  { detail_category: { contains: '予約' } },
                  { main_category: { contains: '予約' } },
                  { sub_category: { contains: '予約' } }
                ]
              },
              {
                OR: [
                  { question: { contains: '変更' } },
                  { answer: { contains: '変更' } },
                  { detail_category: { contains: '変更' } },
                  { main_category: { contains: '変更' } },
                  { sub_category: { contains: '変更' } }
                ]
              }
            ]
          },
          orderBy: {
            updatedAt: 'desc'
          },
          take: 10
        });

        console.log(`>>> 予約変更検索: Prisma findMany で ${reservationChangeKnowledge.length} 件見つかりました`);

        if (reservationChangeKnowledge.length > 0) {
          results = reservationChangeKnowledge.map(knowledge => ({
            ...knowledge,
            score: calculateSearchScore(
              0.9, // 基本スコア
              similarity(knowledge.question || '', originalQuery),
              similarity(knowledge.answer || '', originalQuery),
              calculateCategoryScore(knowledge, originalQuery, []),
              [originalQuery]
            ),
            note: '予約変更に関するナレッジ',
            pgroonga_score: 0.9,
            question_sim: similarity(knowledge.question || '', originalQuery),
            answer_sim: similarity(knowledge.answer || '', originalQuery)
          }));
          
          // スコアでソート
          results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          
          console.log('>>> 予約変更検索: 結果を返します', JSON.stringify(results.map(r => ({ id: r.id, score: r.score, note: r.note }))));
          return addSearchNotes(results, originalQuery);
        }
      } catch (error) {
        console.error('>>> 予約変更検索: 検索中にエラーが発生しました', error);
      }
      console.log('>>> 予約変更検索: 関連ナレッジが見つかりませんでした');
    }

    // ★★★ if 文の直前にログを追加 ★★★
    console.log(`--- Checking for Luxury Car search trigger for query: "${originalQuery}" ---`);
    // 1. 専用トピック検索（最優先）
    // 外車駐車関連の専用検索
    if (originalQuery.includes('外車') || originalQuery.includes('レクサス') ||
        originalQuery.includes('BMW') || originalQuery.includes('ベンツ') ||
        originalQuery.includes('高級車')) {
      console.log('外車駐車関連のクエリを検出しました');

      try {
        // 1. 内容ベースで専用ナレッジを優先検索
        console.log('>>> 外車検索: 内容ベースで専用ナレッジを検索します');
        const specificQuestion = "外車（BMW、ベンツ、アウディなど）で利用したいのですが？";
        const specificAnswer = "外車は場内保険の対象外となるため、お預かりできかねます。";

        const dedicatedKnowledge = await prisma.knowledge.findMany({
          where: {
            OR: [
              { question: specificQuestion },
              { answer: specificAnswer },
            ],
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        });

        if (dedicatedKnowledge.length > 0) {
          console.log('>>> 外車検索: 内容ベースで専用ナレッジが見つかりました。これを優先します。');
          const searchResult: SearchResult = {
            ...dedicatedKnowledge[0],
            score: 1.0,
            note: '外車利用に関する専用回答です',
            pgroonga_score: 1.0,
            question_sim: 1.0,
            answer_sim: 1.0
          };
          results = [searchResult];
        }

        // 2. 関連ナレッジの検索
        console.log('>>> 外車検索: 関連ナレッジを検索します');
        const relatedKnowledge = await prisma.knowledge.findMany({
          where: {
            OR: [
              { question: { contains: '外車' } },
              { answer: { contains: '外車' } },
              { question: { contains: '高級車' } },
              { answer: { contains: '高級車' } },
              { question: { contains: 'レクサス' } },
              { answer: { contains: 'レクサス' } },
              { question: { contains: 'BMW' } },
              { answer: { contains: 'BMW' } },
              { question: { contains: 'ベンツ' } },
              { answer: { contains: 'ベンツ' } },
              { main_category: '車種' },
              { main_category: '利用制限' },
              { sub_category: '外車' },
            ],
            NOT: {
              OR: [
                { question: specificQuestion },
                { answer: specificAnswer },
              ]
            }
          },
          orderBy: [
            { main_category: 'desc' }, // 車種や利用制限を優先
            { updatedAt: 'desc' },     // 次に更新日時
          ],
          take: 5, // 上位5件を取得
        });

        console.log(`>>> 外車検索: findMany で ${relatedKnowledge.length} 件見つかりました`);

        if (relatedKnowledge.length > 0) {
          const relatedResults = relatedKnowledge.map((knowledge) => ({
            ...knowledge,
            score: calculateSearchScore(
              0.8, // 基本スコア
              similarity(knowledge.question || '', originalQuery),
              similarity(knowledge.answer || '', originalQuery),
              calculateCategoryScore(knowledge, originalQuery, []),
              [originalQuery]
            ),
            note: '外車関連のナレッジ',
            pgroonga_score: 0.8,
            question_sim: similarity(knowledge.question || '', originalQuery),
            answer_sim: similarity(knowledge.answer || '', originalQuery)
          }));

          // 専用ナレッジと関連ナレッジを結合
          results = [...results, ...relatedResults];
          
          // スコアでソート（デフォルト値を0に設定）
          results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          
          console.log('>>> 外車検索: 結果を返します', JSON.stringify(results));
          return addSearchNotes(results, originalQuery);
        }

      } catch (error) {
        console.error('>>> 外車検索: 検索中にエラーが発生しました', error);
      }
      console.log('>>> 外車検索: 関連ナレッジが見つかりませんでした');
    }

    // ★★★ if 文の直前にログを追加 ★★★
    console.log(`--- Checking for International Flight search trigger for query: "${originalQuery}" ---`);
    // 国際線関連の専用検索
    if (originalQuery.includes('国際線') || (originalQuery.includes('国際') &&
        (originalQuery.includes('線') || originalQuery.includes('便')))) {
      console.log('国際線関連のクエリを検出しました');

      try {
        // 1. 内容ベースで専用ナレッジを優先検索
        console.log('>>> 国際線検索: 内容ベースで専用ナレッジを検索します');
        const specificQuestion = "国際線の利用は可能ですか？";
        const specificAnswer = "当駐車場は国内線ご利用のお客様専用となっております。";

        const dedicatedKnowledge = await prisma.knowledge.findMany({
          where: {
            OR: [
              { question: specificQuestion },
              { answer: specificAnswer }
            ]
          },
          orderBy: {
            updatedAt: 'desc',
          },
          take: 1,
        });

        if (dedicatedKnowledge.length > 0) {
          console.log('>>> 国際線検索: 内容ベースで専用ナレッジが見つかりました。これを優先します。');
          const searchResult: SearchResult = {
            ...dedicatedKnowledge[0],
            score: 1.0,
            note: '国際線利用に関する専用回答です',
            pgroonga_score: 1.0,
            question_sim: 1.0,
            answer_sim: 1.0
          };
          results = [searchResult];
        }

        // 2. 関連ナレッジの検索
        console.log('>>> 国際線検索: 関連ナレッジを検索します');
        const relatedKnowledge = await prisma.knowledge.findMany({
          where: {
            OR: [
              { question: { contains: '国際線' } },
              { answer: { contains: '国際線' } },
              { question: { contains: '国際便' } },
              { answer: { contains: '国際便' } },
              { question: { contains: '国内線' } },
              { answer: { contains: '国内線' } },
              { main_category: 'フライト情報' },
              { main_category: '利用制限' },
              { sub_category: '国際線' },
            ],
            NOT: {
              OR: [
                { question: specificQuestion },
                { answer: specificAnswer }
              ]
            }
          },
          orderBy: [
            { main_category: 'desc' }, // フライト情報や利用制限を優先
            { updatedAt: 'desc' },     // 次に更新日時
          ],
          take: 5, // 上位5件を取得
        });

        console.log(`>>> 国際線検索: findMany で ${relatedKnowledge.length} 件見つかりました`);

        if (relatedKnowledge.length > 0) {
          const relatedResults = relatedKnowledge.map((knowledge) => ({
            ...knowledge,
            score: calculateSearchScore(
              0.8, // 基本スコア
              similarity(knowledge.question || '', originalQuery),
              similarity(knowledge.answer || '', originalQuery),
              calculateCategoryScore(knowledge, originalQuery, []),
              [originalQuery]
            ),
            note: '国際線関連のナレッジ',
            pgroonga_score: 0.8,
            question_sim: similarity(knowledge.question || '', originalQuery),
            answer_sim: similarity(knowledge.answer || '', originalQuery)
          }));

          // 専用ナレッジと関連ナレッジを結合
          results = [...results, ...relatedResults];
          
          // スコアでソート（デフォルト値を0に設定）
          results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
          
          console.log('>>> 国際線検索: 結果を返します', JSON.stringify(results));
          return addSearchNotes(results, originalQuery);
        }

      } catch (error) {
        console.error('>>> 国際線検索: 検索中にエラーが発生しました', error);
      }
      console.log('>>> 国際線検索: 関連ナレッジが見つかりませんでした');
    }
    
    // キャンセル関連の検索
    if (originalQuery.includes('キャンセル') || 
        originalQuery.includes('解約') || 
        originalQuery.includes('取り消し')) {
      console.log('キャンセル関連のクエリを検出しました');

      try {
        const cancelKnowledge = await prisma.knowledge.findMany({
          where: {
            OR: [
              { main_category: 'キャンセル' },
              { sub_category: 'キャンセル' },
              { detail_category: { contains: 'キャンセル' } },
              { question: { contains: 'キャンセル' } },
              { answer: { contains: 'キャンセル' } }
            ]
          },
          orderBy: {
            updatedAt: 'desc'
          }
        });

        if (cancelKnowledge.length > 0) {
          const cancelResults = cancelKnowledge.map(knowledge => {
            // キャンセル料支払いに関する特別なスコアリング
            const isPaymentRelated = 
              (knowledge.question?.includes('支払') || knowledge.answer?.includes('支払')) &&
              (originalQuery.includes('支払') || originalQuery.includes('料金') || originalQuery.includes('費用'));
            
            // 支払い関連の詳細度に基づいてベーススコアを調整
            const baseScore = isPaymentRelated ? 
              (knowledge.detail_category?.includes('支払') ? 0.95 : 0.94) : 
              (knowledge.detail_category?.includes('手続') ? 0.93 : 0.9);

            // 質問と回答の類似度を計算
            const questionSim = similarity(knowledge.question || '', originalQuery);
            const answerSim = similarity(knowledge.answer || '', originalQuery);
            
            // カテゴリスコアを計算
            const categoryScore = calculateCategoryScore(knowledge, originalQuery, []);
            
            // 最終スコアを計算
            const score = calculateSearchScore(
              baseScore,
              Math.max(questionSim, answerSim),
              categoryScore,
              categoryScore,
              [originalQuery]
            );

            return {
              ...knowledge,
              score,
              note: isPaymentRelated ? 'キャンセル料支払いに関する情報です' : 'キャンセル手続きに関する情報です',
              pgroonga_score: baseScore,
              question_sim: questionSim,
              answer_sim: answerSim
            };
          });

          // スコアでソート（スコアが同じ場合は支払い関連を優先）
          cancelResults.sort((a, b) => {
            const scoreDiff = (b.score ?? 0) - (a.score ?? 0);
            if (scoreDiff !== 0) return scoreDiff;
            
            // スコアが同じ場合の優先順位
            const aIsPayment = a.detail_category?.includes('支払') ?? false;
            const bIsPayment = b.detail_category?.includes('支払') ?? false;
            if (aIsPayment !== bIsPayment) return bIsPayment ? 1 : -1;
            
            // それでも同じ場合はIDの小さい方を優先
            return a.id - b.id;
          });
          
          console.log('キャンセル関連検索結果（改善版）:', 
            cancelResults.map(r => ({ 
              id: r.id, 
              score: r.score, 
              note: r.note,
              detail: r.detail_category
            }))
          );
          
          return addSearchNotes(cancelResults, originalQuery);
        }
      } catch (error) {
        console.error('キャンセル関連検索中にエラーが発生しました:', error);
      }
    }
    
    // 2. タグベースの検索（特定のタグが指定された場合）
    if (tags.length > 0) {
      console.log(`タグ検索を実行: [${tags.join(', ')}]`);
      const tagResults = await searchKnowledgeByTags(tags);
      
      if (tagResults.length > 0) {
        console.log(`タグ検索で ${tagResults.length} 件の結果が見つかりました`);
        results = tagResults.map(result => ({
          ...result.knowledge,
          score: result.score,
          note: 'タグ検索で見つかりました'
        })) as SearchResult[];
        
        return addSearchNotes(results, originalQuery);
      }
    }
    
    // 3. ハイブリッド検索（修正版 - 確実にナレッジを見つける）
    try {
      console.log('直接SQL検索を実行');
      if (originalQuery && originalQuery.trim() !== '') {
        // 「の」を含む複合キーワード検索のための処理
        const hasCompoundKeyword = originalQuery.includes('の');
        let firstPart = '';
        let secondPart = '';
        
        if (hasCompoundKeyword) {
          const parts = originalQuery.split('の');
          firstPart = parts[0].trim();
          secondPart = parts.length > 1 ? parts[1].trim() : '';
          console.log(`複合キーワード検出: 前半="${firstPart}", 後半="${secondPart}"`);
        }

        // SQLインジェクション防止のためPrisma.sqlを使用
        const whereConditions = [];

        // 基本検索条件
        whereConditions.push(Prisma.sql`k.question ILIKE ${'%' + originalQuery + '%'}`);
        whereConditions.push(Prisma.sql`k.answer ILIKE ${'%' + originalQuery + '%'}`);
        whereConditions.push(Prisma.sql`k.detail_category ILIKE ${'%' + originalQuery + '%'}`);
        whereConditions.push(Prisma.sql`k.main_category ILIKE ${'%' + originalQuery + '%'}`);
        whereConditions.push(Prisma.sql`k.sub_category ILIKE ${'%' + originalQuery + '%'}`);
        whereConditions.push(Prisma.sql`k.sub_category = ${originalQuery}`);

        // 複合キーワード検索条件
        if (hasCompoundKeyword && firstPart && secondPart) {
          // サブカテゴリに第一キーワードが含まれ、質問・回答・詳細カテゴリに第二キーワードが含まれる
          whereConditions.push(Prisma.sql`(
            k.sub_category ILIKE ${'%' + firstPart + '%'} AND 
            (
              k.question ILIKE ${'%' + secondPart + '%'} OR 
              k.answer ILIKE ${'%' + secondPart + '%'} OR 
              k.detail_category ILIKE ${'%' + secondPart + '%'}
            )
          )`);
        }

        // 最終的なWHERE句を作成
        const whereClause = Prisma.sql`(${Prisma.join(whereConditions, ' OR ')})`;

        // 結果の順序付け
        results = await prisma.$queryRaw<SearchResult[]>`
          SELECT
            k.id, k.main_category, k.sub_category, k.detail_category, k.question, k.answer,
            k.is_template, k.usage, k.note, k.issue, k."createdAt", k."updatedAt",
            0.9 AS pgroonga_score,
            similarity(COALESCE(k.question, ''), ${originalQuery}) as question_sim,
            similarity(COALESCE(k.answer, ''), ${originalQuery}) as answer_sim
          FROM "Knowledge" k
          WHERE ${whereClause}
          ORDER BY
            CASE
              WHEN k.sub_category = ${originalQuery} THEN 1
              WHEN k.sub_category ILIKE ${'%' + originalQuery + '%'} THEN 2
              WHEN k.question ILIKE ${'%' + originalQuery + '%'} THEN 3
              WHEN k.answer ILIKE ${'%' + originalQuery + '%'} THEN 4
              ELSE 5
            END,
            k."updatedAt" DESC
          LIMIT 20
        `;
        
        console.log(`直接SQL検索で ${results.length} 件のナレッジが見つかりました`);
        
        if (results.length > 0) {
          // 検索結果にスコアと注釈を追加
          results = results.map(entry => {
            // スコアと注釈を初期化
            let score = 0;
            let note = '直接SQL検索で見つかりました';
            
            // サブカテゴリ完全一致
            if (entry.sub_category === originalQuery) {
              score = 0.95;
              note = 'カテゴリ完全一致で見つかりました';
            } 
            // サブカテゴリ部分一致
            else if (entry.sub_category?.toLowerCase().includes(originalQuery.toLowerCase())) {
              score = 0.9;
              note = 'カテゴリ部分一致で見つかりました';
            }
            // 複合キーワード一致（例：「キャンセルの方法」）
            else if (hasCompoundKeyword && firstPart && secondPart) {
              // サブカテゴリが第一キーワードに一致
              const matchesFirstKeyword = entry.sub_category?.toLowerCase().includes(firstPart.toLowerCase()) || false;
              
              // 詳細カテゴリが第二キーワードに関連する
              const detailMatches = entry.detail_category?.toLowerCase().includes(secondPart.toLowerCase()) || false;
              
              if (matchesFirstKeyword && detailMatches) {
                score = 0.94;
                note = `「${firstPart}」のカテゴリで「${secondPart}」に関する詳細情報が見つかりました`;
              } else if (matchesFirstKeyword) {
                score = 0.93;
                note = '複合キーワード検索で見つかりました';
              } else {
                score = calculateScore({ 
                  id: entry.id,
                  question: entry.question,
                  answer: entry.answer,
                  main_category: entry.main_category,
                  sub_category: entry.sub_category,
                  detail_category: entry.detail_category,
                  pgroonga_score: entry.pgroonga_score,
                  question_sim: entry.question_sim,
                  answer_sim: entry.answer_sim
                } as SearchResult, originalQuery);
              }
            }
            // その他の一致
            else {
              score = calculateScore({ 
                id: entry.id,
                question: entry.question,
                answer: entry.answer,
                main_category: entry.main_category,
                sub_category: entry.sub_category,
                detail_category: entry.detail_category,
                pgroonga_score: entry.pgroonga_score,
                question_sim: entry.question_sim,
                answer_sim: entry.answer_sim
              } as SearchResult, originalQuery);
            }
            
            return {
              ...entry,
              score,
              note
            };
          });
          
          console.log('>>> 検索結果:', 
                     JSON.stringify(results.map(r => ({ 
                       id: r.id, 
                       score: r.score, 
                       note: r.note, 
                       sub_category: r.sub_category,
                       detail_category: r.detail_category
                     }))));
          return addSearchNotes(results, originalQuery);
        }
      } else {
        console.log('オリジナルクエリが空のため、検索をスキップします。');
        results = [];
      }
    } catch (error) {
      console.error('検索でエラーが発生しました:', error);
    }

    // 8. 最新エントリのフォールバック（最終手段）
    console.log('関連する結果が見つからなかったため、最新のエントリを表示します');
    const latestResults = await prisma.knowledge.findMany({
      orderBy: {
        createdAt: 'desc'
      },
      take: 5
    });
    
    results = latestResults.map(result => ({
      ...result,
      score: 0.1,
      note: '関連する結果が見つからなかったため、最新のエントリを表示しています'
    })) as SearchResult[];
    
    return addSearchNotes(results, originalQuery);
    
  } catch (error) {
    console.error('検索処理全体でエラーが発生しました:', error);
    return [];
  }
}

/**
 * 文字列の類似度を計算する関数
 */
function similarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  // 両方の文字列を小文字に変換
  const s1 = text1.toLowerCase();
  const s2 = text2.toLowerCase();
  
  // 完全一致の場合は最大スコア
  if (s1 === s2) return 1.0;
  
  // 一方が他方を含む場合は高いスコア
  if (s1.includes(s2)) return 0.9;
  if (s2.includes(s1)) return 0.9;
  
  // 単語レベルでの部分一致
  const words1 = s1.split(/\s+/).filter(Boolean);
  const words2 = s2.split(/\s+/).filter(Boolean);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // 単語の一致数をカウント
  let matchCount = 0;
  for (const word1 of words1) {
    if (words2.some(word2 => word2.includes(word1) || word1.includes(word2))) {
      matchCount++;
    }
  }
  
  // 類似度スコアを計算
  const maxLength = Math.max(words1.length, words2.length);
  return matchCount / maxLength;
}