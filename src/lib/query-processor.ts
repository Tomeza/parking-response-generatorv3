/**
 * 検索クエリの前処理を強化するモジュール
 * 日本語のクエリから重要なキーワードを抽出し、同義語を展開する
 */

// 同義語マッピング
const SYNONYM_MAP: Record<string, string[]> = {
  // 外車関連
  '外車': ['輸入車', '海外車', '外国車', '高級車'],
  'レクサス': ['外車', '高級車'],
  'BMW': ['外車', '高級車', 'ビーエムダブリュー'],
  'ベンツ': ['外車', '高級車', 'メルセデス'],
  'アウディ': ['外車', '高級車'],
  
  // 駐車関連
  '駐車': ['停める', 'パーキング', '駐める', '駐車場'],
  '停める': ['駐車', 'パーキング'],
  'パーキング': ['駐車', '駐車場'],
  
  // 予約関連
  '予約': ['申込', '予め取る', '事前確保', 'リザーブ'],
  '申込': ['予約', '予約する'],
  'リザーブ': ['予約'],
  
  // 営業時間関連
  '営業時間': ['開いている時間', '営業している時間', 'オープン時間', '利用可能時間'],
  '開店時間': ['営業時間', 'オープン時間'],
  '閉店時間': ['営業時間', 'クローズ時間'],
  
  // キャンセル関連
  'キャンセル': ['取消', '取り消し', '解約', 'キャンセレーション'],
  '取消': ['キャンセル', '解約'],
  '解約': ['キャンセル', '取消'],
  
  // 料金関連
  '料金': ['価格', '費用', '代金', 'コスト', '値段'],
  '価格': ['料金', '代金'],
  '費用': ['料金', '代金'],
  
  // 変更関連
  '変更': ['修正', '変える', '更新', '訂正'],
  '修正': ['変更', '直す'],
  '更新': ['変更', '最新化']
};

/**
 * 日本語クエリから重要なキーワードを抽出する関数
 */
export function extractKeywords(query: string): string[] {
  // 不要な助詞や記号を削除
  const normalized = query.replace(/[はがのにへでとやもをのような、。．！？!?.\s]+/g, ' ').trim();
  
  // 単語に分割
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // 重要キーワードを蓄積する配列
  const keywords: string[] = [];
  
  // 特定のキーワードの組み合わせパターンを検出
  if (detectKeywordPattern(normalized, ['外車', '駐車'])) {
    keywords.push('外車駐車');
    keywords.push('外車 駐車');
    keywords.push('外車や大型高級車でも駐車場を利用');
    keywords.push('外車や大型高級車の駐車');
    keywords.push('補償の都合上');
  }
  
  if (detectKeywordPattern(normalized, ['予約', '変更'])) {
    keywords.push('予約変更');
    keywords.push('予約を変更');
    keywords.push('予約の変更方法');
    keywords.push('予約内容の変更');
  }
  
  if (detectKeywordPattern(normalized, ['国際線', '利用'])) {
    keywords.push('国際線利用');
    keywords.push('国際線を利用');
    keywords.push('国際線ご利用のお客様');
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
  }
  
  // 国際線の特殊処理
  if (query.includes('国際線') || query.includes('インターナショナル')) {
    expandedKeywords.push('国際線');
    expandedKeywords.push('国際線利用');
    expandedKeywords.push('国際線ご利用のお客様');
    expandedKeywords.push('国内線ご利用のお客様専用');
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
  const brands = ['レクサス', 'BMW', 'ベンツ', 'アウディ', 'メルセデス', 'ポルシェ'];
  return brands.some(brand => text.includes(brand));
}

// キーワードを処理する関数
function processKeyword(word: string, keywords: string[]): void {
  // 外車関連
  if (word.includes('外車') || word === '外車' || word.includes('輸入車')) {
    keywords.push('外車');
    keywords.push('高級車');
    keywords.push('大型車');
    keywords.push('レクサス');
    keywords.push('BMW');
    keywords.push('ベンツ');
    keywords.push('アウディ');
  }
  
  // 駐車関連
  if (word.includes('駐車') || word.includes('停め') || word.includes('パーキング')) {
    keywords.push('駐車');
    keywords.push('駐車場');
    keywords.push('パーキング');
  }
  
  // 予約関連
  if (word.includes('予約') || word.includes('申込') || word.includes('申し込み')) {
    keywords.push('予約');
    keywords.push('申込');
    keywords.push('ご予約');
  }
  
  // 営業時間関連
  if (word.includes('営業') || word.includes('時間') || word.includes('何時')) {
    keywords.push('営業');
    keywords.push('営業時間');
    keywords.push('利用時間');
  }
  
  // キャンセル関連
  if (word.includes('キャンセル') || word.includes('取消') || word.includes('取り消し')) {
    keywords.push('キャンセル');
    keywords.push('取消');
    keywords.push('解約');
  }
  
  // 料金関連
  if (word.includes('料金') || word.includes('費用') || word.includes('代金')) {
    keywords.push('料金');
    keywords.push('価格');
    keywords.push('費用');
  }
  
  // 国際線関連
  if (word.includes('国際線') || word.includes('国際')) {
    keywords.push('国際線');
    keywords.push('国際便');
    keywords.push('インターナショナル');
  }
} 