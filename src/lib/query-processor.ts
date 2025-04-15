/**
 * 検索クエリの前処理を強化するモジュール
 * 日本語のクエリから重要なキーワードを抽出し、同義語を展開する
 */

import { AlertType, detectAlertKeywords } from './alert-system';

// 同義語マッピング
const SYNONYM_MAP: Record<string, string[]> = {
  // 外車関連
  '外車': ['輸入車', '海外車', '外国車', '高級車', 'bmw', 'ベンツ', 'アウディ', 'レクサス'],
  'レクサス': ['外車', '高級車', 'lexus'],
  'BMW': ['外車', '高級車', 'ビーエムダブリュー', 'bmw'],
  'ベンツ': ['外車', '高級車', 'メルセデス', 'メルセデスベンツ'],
  'アウディ': ['外車', '高級車', 'audi'],
  
  // 駐車関連
  '駐車': ['停める', 'パーキング', '駐める', '駐車場', '停車', '車を置く'],
  '停める': ['駐車', 'パーキング', '駐める'],
  'パーキング': ['駐車', '駐車場', '駐輪'],
  
  // 予約関連
  '予約': ['申込', '予め取る', '事前確保', 'リザーブ', '予約する', 'booking'],
  '申込': ['予約', '予約する', '申し込み'],
  'リザーブ': ['予約', '取っておく'],
  
  // 営業時間関連
  '営業時間': ['開いている時間', '営業している時間', 'オープン時間', '利用可能時間', '何時から何時まで'],
  '開店時間': ['営業時間', 'オープン時間', '開店', '開く時間'],
  '閉店時間': ['営業時間', 'クローズ時間', '閉める時間', '閉店'],
  
  // キャンセル関連
  'キャンセル': ['取消', '取り消し', '解約', 'キャンセレーション', 'キャンセルする', 'cancel'],
  '取消': ['キャンセル', '解約', '取り消し'],
  '解約': ['キャンセル', '取消', 'キャンセルする'],
  
  // 料金関連
  '料金': ['価格', '費用', '代金', 'コスト', '値段', '料金表', 'いくら', '料金はいくら'],
  '価格': ['料金', '代金', '金額', '費用'],
  '費用': ['料金', '代金', '費用', 'コスト'],
  
  // 変更関連
  '変更': ['修正', '変える', '更新', '訂正', '変えたい', '直したい'],
  '修正': ['変更', '直す', '訂正'],
  '更新': ['変更', '最新化', 'アップデート'],
  
  // 国際線関連
  '国際線': ['インターナショナル', '国際便', '国際空港', '海外便', '海外行き'],
  'インターナショナル': ['国際線', '国際便', '海外'],
  
  // 送迎関連
  '送迎': ['送り迎え', 'ピックアップ', '迎えに来る', '迎えのサービス'],
  '迎え': ['送迎', 'ピックアップ', '迎えに来る'],
  
  // 人数関連
  '人数': ['何人', '定員', '乗車人数', '人員', 'メンバー数']
};

/**
 * 日本語クエリから重要なキーワードを抽出する関数
 */
export function extractKeywords(query: string): string[] {
  // クエリの正規化：小文字化し、不要な助詞や記号を削除
  const normalized = query.toLowerCase().replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // 重要キーワードを蓄積する配列
  const keywords: string[] = [];
  
  // アラートワードを検出して優先的に追加
  const alertTypes = detectAlertKeywords(query);
  if (alertTypes.includes(AlertType.LUXURY_CAR)) {
    keywords.push('外車', '高級車', '大型高級車', 'レクサス', 'BMW', 'ベンツ', 'アウディ');
  }
  
  if (alertTypes.includes(AlertType.INTERNATIONAL_FLIGHT)) {
    keywords.push('国際線', '国際便', 'インターナショナル', '国際ターミナル');
  }
  
  if (alertTypes.includes(AlertType.BUSY_PERIOD)) {
    keywords.push('繁忙期', 'お盆', '年末年始', 'ゴールデンウィーク', 'GW', '連休');
  }
  
  if (alertTypes.includes(AlertType.RESERVATION_CHANGE)) {
    keywords.push('予約変更', '予約の変更', '予約内容の変更', '変更方法');
  }
  
  if (alertTypes.includes(AlertType.MAX_PASSENGERS)) {
    keywords.push('乗車人数', '人数制限', '最大4名', '送迎人数');
  }
  
  // 特定のキーワードの組み合わせパターンを検出
  if (detectKeywordPattern(normalized, ['外車', '駐車'])) {
    keywords.push('外車駐車');
    keywords.push('外車 駐車');
    keywords.push('外車や大型高級車でも駐車場を利用');
    keywords.push('外車や大型高級車の駐車');
    keywords.push('補償の都合上');
    keywords.push('外車は駐車できません');
  }
  
  if (detectKeywordPattern(normalized, ['予約', '変更'])) {
    keywords.push('予約変更');
    keywords.push('予約を変更');
    keywords.push('予約の変更方法');
    keywords.push('予約内容の変更');
    keywords.push('予約変更期限');
  }
  
  if (detectKeywordPattern(normalized, ['国際', '利用']) || 
      detectKeywordPattern(normalized, ['国際線', '使える'])) {
    keywords.push('国際線利用');
    keywords.push('国際線を利用');
    keywords.push('国際線ご利用のお客様');
    keywords.push('国際線は利用できません');
  }

  if (detectKeywordPattern(normalized, ['人数', '制限']) || 
      detectKeywordPattern(normalized, ['何人', '乗れる'])) {
    keywords.push('乗車人数');
    keywords.push('人数制限');
    keywords.push('最大4名様まで');
    keywords.push('定員オーバー');
  }
  
  // 個別のキーワードを処理
  for (const word of words) {
    processKeyword(word, keywords);
  }
  
  // 元のクエリを追加
  keywords.push(normalized);
  
  // 重複を削除して返す
  return [...new Set(keywords)];
}

/**
 * 抽出したキーワードに同義語を追加する関数
 */
export function expandSynonyms(keywords: string[]): string[] {
  const expanded = [...keywords];
  
  for (const keyword of keywords) {
    // 完全一致の同義語があれば追加
    if (SYNONYM_MAP[keyword]) {
      expanded.push(...SYNONYM_MAP[keyword]);
    }
    
    // 部分一致の同義語も検討
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (keyword.includes(key)) {
        expanded.push(...synonyms);
      }
    }
  }
  
  // 重複を削除して返す
  return [...new Set(expanded)];
}

/**
 * クエリ前処理の強化版関数
 */
export function enhancedPreprocessQuery(query: string): string {
  // キーワードを抽出
  const keywords = extractKeywords(query);
  
  // 同義語を展開
  const expandedKeywords = expandSynonyms(keywords);
  
  // 高級車ブランドの特殊処理
  if (containsLuxuryCarBrand(query)) {
    expandedKeywords.push('外車');
    expandedKeywords.push('高級車');
    expandedKeywords.push('大型高級車');
    expandedKeywords.push('外車や大型高級車');
    expandedKeywords.push('全外車');
    expandedKeywords.push('保険対象外');
  }
  
  // 国際線の特殊処理
  if (query.toLowerCase().includes('国際線') || 
      query.toLowerCase().includes('インターナショナル') || 
      query.toLowerCase().includes('海外便')) {
    expandedKeywords.push('国際線');
    expandedKeywords.push('国際線利用');
    expandedKeywords.push('国際線ご利用のお客様');
    expandedKeywords.push('国内線ご利用のお客様専用');
    expandedKeywords.push('国際線ターミナル');
  }
  
  // カテゴリキーワードの追加
  if (expandedKeywords.some(k => ['予約', '申込', 'リザーブ'].includes(k))) {
    expandedKeywords.push('予約関連');
  }
  
  if (expandedKeywords.some(k => ['料金', '価格', '費用', 'コスト'].includes(k))) {
    expandedKeywords.push('料金関連');
  }
  
  if (expandedKeywords.some(k => ['キャンセル', '取消', '解約'].includes(k))) {
    expandedKeywords.push('キャンセル関連');
  }
  
  if (expandedKeywords.some(k => ['営業時間', '開店', '閉店'].includes(k))) {
    expandedKeywords.push('営業時間関連');
  }
  
  // 重複を削除して空白で結合
  return [...new Set(expandedKeywords)].join(' ');
}

// 特定のキーワードパターンを検出する関数
function detectKeywordPattern(text: string, keywords: string[]): boolean {
  return keywords.every(keyword => text.includes(keyword));
}

// 高級車ブランドを含むかチェックする関数
function containsLuxuryCarBrand(text: string): boolean {
  const brands = ['レクサス', 'bmw', 'ベンツ', 'アウディ', 'メルセデス', 'ポルシェ', '外車', '高級車'];
  const normalizedText = text.toLowerCase();
  return brands.some(brand => normalizedText.includes(brand.toLowerCase()));
}

// キーワードを処理する関数
function processKeyword(word: string, keywords: string[]): void {
  const normalizedWord = word.toLowerCase();
  
  // 外車関連
  if (normalizedWord.includes('外車') || normalizedWord === '外車' || normalizedWord.includes('輸入車') || 
      ['レクサス', 'bmw', 'ベンツ', 'アウディ'].some(brand => normalizedWord.includes(brand.toLowerCase()))) {
    keywords.push('外車');
    keywords.push('高級車');
    keywords.push('大型車');
    keywords.push('レクサス');
    keywords.push('bmw');
    keywords.push('ベンツ');
    keywords.push('アウディ');
    keywords.push('車両制限');
  }
  
  // 駐車関連
  if (normalizedWord.includes('駐車') || normalizedWord.includes('停め') || 
      normalizedWord.includes('パーキング') || normalizedWord.includes('車を置')) {
    keywords.push('駐車');
    keywords.push('駐車場');
    keywords.push('パーキング');
    keywords.push('駐車する');
  }
  
  // 予約関連
  if (normalizedWord.includes('予約') || normalizedWord.includes('申込') || 
      normalizedWord.includes('申し込') || normalizedWord.includes('リザーブ')) {
    keywords.push('予約');
    keywords.push('申込');
    keywords.push('ご予約');
    keywords.push('予約する');
    keywords.push('予約方法');
  }
  
  // 営業時間関連
  if (normalizedWord.includes('営業') || normalizedWord.includes('時間') || 
      normalizedWord.includes('何時') || normalizedWord.includes('いつ')) {
    keywords.push('営業');
    keywords.push('営業時間');
    keywords.push('利用時間');
    keywords.push('営業時間関連');
  }
  
  // キャンセル関連
  if (normalizedWord.includes('キャンセル') || normalizedWord.includes('取消') || 
      normalizedWord.includes('取り消し') || normalizedWord.includes('解約')) {
    keywords.push('キャンセル');
    keywords.push('取消');
    keywords.push('解約');
    keywords.push('キャンセル方法');
    keywords.push('キャンセル料金');
  }
  
  // 料金関連
  if (normalizedWord.includes('料金') || normalizedWord.includes('費用') || 
      normalizedWord.includes('代金') || normalizedWord.includes('いくら') || 
      normalizedWord.includes('金額') || normalizedWord.includes('価格')) {
    keywords.push('料金');
    keywords.push('価格');
    keywords.push('費用');
    keywords.push('料金関連');
    keywords.push('料金表');
  }
  
  // 国際線関連
  if (normalizedWord.includes('国際線') || normalizedWord.includes('国際') || 
      normalizedWord.includes('インターナショナル') || normalizedWord.includes('海外便')) {
    keywords.push('国際線');
    keywords.push('国際便');
    keywords.push('インターナショナル');
    keywords.push('国際線ターミナル');
    keywords.push('国際線利用');
  }
  
  // 送迎関連
  if (normalizedWord.includes('送迎') || normalizedWord.includes('迎え') || 
      normalizedWord.includes('ピックアップ') || normalizedWord.includes('送り')) {
    keywords.push('送迎');
    keywords.push('迎え');
    keywords.push('ピックアップ');
    keywords.push('送迎サービス');
  }
  
  // 人数関連
  if (normalizedWord.includes('人数') || normalizedWord.includes('何人') || 
      normalizedWord.includes('定員') || normalizedWord.includes('乗車')) {
    keywords.push('人数');
    keywords.push('定員');
    keywords.push('乗車人数');
    keywords.push('人数制限');
    keywords.push('最大4名様まで');
  }
} 