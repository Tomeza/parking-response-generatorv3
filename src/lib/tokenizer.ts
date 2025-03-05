import * as kuromoji from 'kuromoji';
import path from 'path';

// kuromojiのトークナイザーインスタンス
let tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

// トークナイザーの初期化
export async function initTokenizer(): Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> {
  if (tokenizer) return tokenizer;

  return new Promise((resolve, reject) => {
    const dicPath = path.join(process.cwd(), 'node_modules/kuromoji/dict');
    
    kuromoji.builder({ dicPath }).build((err, _tokenizer) => {
      if (err) {
        console.error('Tokenizer initialization error:', err);
        reject(err);
        return;
      }
      
      tokenizer = _tokenizer;
      resolve(tokenizer);
    });
  });
}

// テキストをトークン化する関数
export async function tokenizeText(text: string): Promise<kuromoji.IpadicFeatures[]> {
  const _tokenizer = await initTokenizer();
  return _tokenizer.tokenize(text);
}

// 重要な品詞（名詞、動詞、形容詞）のみを抽出する関数
export async function extractKeywords(text: string): Promise<string[]> {
  const tokens = await tokenizeText(text);
  
  // 重要な品詞のみをフィルタリング
  const importantTokens = tokens.filter(token => {
    const pos = token.pos;
    return (
      pos === '名詞' || 
      pos === '動詞' || 
      pos === '形容詞' ||
      // 複合語も含める
      (pos === '接頭詞' && token.pos_detail_1 === '名詞接続')
    );
  });
  
  // 基本形を取得（動詞や形容詞の場合は原形を使用）
  return importantTokens.map(token => {
    // 動詞や形容詞の場合は基本形を使用
    if ((token.pos === '動詞' || token.pos === '形容詞') && token.basic_form !== '*') {
      return token.basic_form;
    }
    // それ以外は表層形を使用
    return token.surface_form;
  });
}

// 文章を分析し、重要度に基づいて重み付けされたキーワードを返す関数
export async function analyzeText(text: string): Promise<{ keyword: string; weight: number }[]> {
  const tokens = await tokenizeText(text);
  const keywordMap = new Map<string, number>();
  
  for (const token of tokens) {
    // 重要な品詞のみを対象とする
    if (
      token.pos === '名詞' || 
      token.pos === '動詞' || 
      token.pos === '形容詞'
    ) {
      const keyword = token.pos === '動詞' || token.pos === '形容詞' 
        ? token.basic_form !== '*' ? token.basic_form : token.surface_form
        : token.surface_form;
      
      // 重み付け
      let weight = 1.0;
      
      // 名詞の重みを高くする
      if (token.pos === '名詞') {
        weight = 1.5;
        
        // 固有名詞はさらに重みを高くする
        if (token.pos_detail_1 === '固有名詞') {
          weight = 2.0;
        }
      }
      
      // 既存のキーワードの重みを更新
      if (keywordMap.has(keyword)) {
        keywordMap.set(keyword, keywordMap.get(keyword)! + weight);
      } else {
        keywordMap.set(keyword, weight);
      }
    }
  }
  
  // 重み付けされたキーワードのリストを作成
  return Array.from(keywordMap.entries())
    .map(([keyword, weight]) => ({ keyword, weight }))
    .sort((a, b) => b.weight - a.weight);
}

// テキストから文を抽出する関数
export function extractSentences(text: string): string[] {
  // 句点で分割
  return text
    .split(/[。！？\n]/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
} 